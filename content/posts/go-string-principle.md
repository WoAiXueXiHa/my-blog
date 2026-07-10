---
title: "Go string 原理剖析"
date: 2026-07-10T00:00:00+08:00
draft: false
tags: ["Go", "string", "底层原理", "源码分析"]
categories: ["Go 底层原理"]
summary: "从 C 语言的 \\0 到 Go 的 stringStruct，深入剖析 string 的底层结构、不可变设计、遍历方式、内存共享与泄漏、零拷贝转换、以及六种拼接方式的性能对比。"
---

# string 原理剖析

## 从 C 语言的 `\0` 说起

C 语言的字符串用 `\0`（空字符）标记结尾。读取字符串时，程序从首地址一路往后扫，扫到 `\0` 就停。

这个设计有两个问题：

1. **获取长度是 O(n)** —— 必须遍历整个字符串才能知道多长
2. **字符串中间不能出现 `\0`** —— 二进制数据没法用 C 字符串表示

Go 换了一种思路：**把指针和长度打包成一个结构体**。长度直接存起来，O(1) 就能拿到。

在 `src/runtime/string.go` 中定义了这个结构体：

```go
type stringStruct struct {
    str unsafe.Pointer  // 指向底层字节数组的首地址
    len int             // 字节数，不是字符数
}
```

> `stringStruct` 是 runtime 内部使用的结构体，用户代码无法直接访问。

内存布局长这样：

![image-20260704155932499](https://gitee.com/binary-whispers/pic/raw/master///20260704155935913.png)

一共 16 字节 —— 8 字节的指针 + 8 字节的长度（64 位平台）。没有 `cap` 字段，因为 string 不可变，不需要扩容。

官方在 `src/builtin/builtin.go` 中这样声明：

```go
// string is the set of all strings of 8-bit bytes, conventionally but not
// necessarily representing UTF-8-encoded text. A string may be empty, but
// not nil. Values of string type are immutable.
type string string
```

三个关键信息：

- string 是 **8-bit 字节的集合**，不保证一定是 UTF-8
- 可以为**空**（`""`），但不能为 **nil** —— 编译都过不了
- **不可变**（immutable）

---

## `len(s)` 返回的是字节数，不是字符数

这可能是 Go string 最容易踩的坑。`len` 字段存的是底层占用的**字节数**，不是我们直觉里的"第几个字"。

对于 ASCII 字符（英文、数字），一个字符占 1 个字节，`len` 和字符数刚好相等，所以平时感觉不出问题。但一旦字符串里包含中文，差异立刻暴露——UTF-8 编码下每个中文字符占 3 个字节：

```go
s := "你好"
fmt.Println(len(s))                    // 6 —— 字节数，不是 2
fmt.Println(utf8.RuneCountInString(s)) // 2 —— 这才是字符数
```

`"你好"` 这两个字：'你' 占 3 字节，'好' 占 3 字节，一共 6 字节。`len(s)` 老老实实告诉你 6。

> `len(s)` 是字节数。要拿字符数，用 `utf8.RuneCountInString(s)` 或 `len([]rune(s))`。

---

## 为什么设计成不可变？

Go 把字符串内容放在**只读内存区**。一旦创建，内容不能修改。这让很多人不习惯——改个字符而已，至于吗？

至于。不可变设计带来了三个关键好处：

1. **线程安全**。任意多个 goroutine 同时读同一个字符串，完全不需要加锁。内容不变，怎么读都不会出乱子。

2. **哈希稳定**。string 作为 map 的 key 时，哈希值算一次就够了，之后不会变。如果 string 内容可变，map 内部就全乱了——key 的哈希值变了，map 找不到原来的桶。

3. **子串可以共享底层内存**。`s[1:3]` 取子串是 O(1) 的，新字符串直接复用原串的底层数组，不用拷贝。如果内容可变，这种共享就不安全了——改 `s1` 会连带改 `s2`。

下面的图展示了两个字符串变量指向同一块底层内存：

![image-20260704154127004](https://gitee.com/binary-whispers/pic/raw/master///20260704154128583.png)

Go 从根本上禁止了修改操作——`s[0] = 'x'` 编译直接报错。

如果非要做"修改"，只能让变量指向新内存：

![image-20260704154637568](https://gitee.com/binary-whispers/pic/raw/master///20260704154639314.png)

注意：**原字符串没变**。你只是让变量指向了一块新分配的内存，里面放着修改后的内容。`demo2/demo2.go` 演示了这个过程：

```go
s := "Hello"
strByte := []byte(s)   // 拷贝 -> 新内存
strByte[0] = 'h'       // 改的是新内存
fmt.Println(string(strByte)) // "hello"
// 此时 s 还是 "Hello"，完全没有变化
```

> string 不可变，改不了。想"改"只能走 `[]byte` / `[]rune` 中转，拿到的是全新的字符串。

---

## 遍历字符串的三种姿势

先明确两个类型：

```go
type rune = int32   // Unicode 码点，4 个字节，能装下所有字符
type byte = uint8   // 1 个字节，只够 ASCII
```

`rune` 和 `byte` 是两个层面的东西——前者是"字符"，后者是"字节"。遍历字符串时，选择不同的方式，拿到的结果完全不同。

### 方式一：逐字节遍历

```go
s := "你好Go"
for i := 0; i < len(s); i++ {
    fmt.Printf("%x ", s[i])  // e4 bd a0 e5 a5 bd 47 6f
}
```

每一步拿到一个 `byte`。中文字符被拆成 3 个独立的字节，单个字节没有意义——全是乱码。

### 方式二：`for range` 逐 rune 遍历

```go
for _, r := range s {
    fmt.Printf("%c ", r)  // 你 好 G o
}
```

Go 自动按 UTF-8 解码，每一步拿到一个完整的 Unicode 字符（`rune`，即 `int32`）。`demo1/demo1.go` 输出的是 rune 的数值：

![image-20260704152406209](https://gitee.com/binary-whispers/pic/raw/master///20260704152408999.png)

### 方式三：带索引的 `for range`

```go
for i, r := range s {
    fmt.Printf("s[%d]=%c ", i, r)  // s[0]=你 s[3]=好 s[6]=G s[7]=o
}
```

索引 `i` 不是 0, 1, 2, 3，而是 **0, 3, 6, 7**。因为"你"占 3 个字节，所以'好'的起始位置是 3；"好"占 3 个字节，所以'G'的起始位置是 6。

> `for range` 自动按 UTF-8 解码为 rune，索引是**字节偏移量**。普通 `for i` 逐字节遍历，中文场景直接乱码。

### 什么时候必须转 `[]rune`？

当你需要按**字符位置**（而不是字节位置）增删改时：

```go
s := "你好世界"
r := []rune(s)    // 分配新内存：['你', '好', '世', '界']
r[1] = '嗨'       // 修改第二个字符
s = string(r)     // 转回去："你嗨世界"
```

不转 `[]rune` 直接 `s[1]`，拿到的是 `0xbd`（"你"的第三个字节），不是"好"，改它只会破坏 UTF-8 编码。

---

## 子串共享内存与内存泄漏

因为 string 不可变，取子串 `s[low:high]` 不需要拷贝数据——新字符串的 `str` 指针直接指向原数组的偏移位置，O(1) 完成。

```go
s := "hello, world"
sub := s[0:5]  // "hello" —— 和 s 共享底层 13 字节的内存
```

```
s:   +------------------+
     | str: 0x...100    |---+
     | len: 13          |   |
     +------------------+   |
                            v
sub: +------------------+   0x...100  0x...10D
     | str: 0x...100    |   +--------------------------------+
     | len: 5           |   | h | e | l | l | o | , |  | w | ...
     +------------------+   +--------------------------------+
                            sub 能看到的范围 ↑ (len=5)
                            整个底层数组仍被 s 或 sub 引用 ↑
```

绝大多数场景下这是好事——省内存、速度快。但有一个坑：**如果从一个大字符串截一小段，且原字符串被 GC 了，底层大数组仍然被小子串"锚定"，无法回收**。

```go
content := readHugeFile()      // 1GB
firstLine := content[:100]     // 只要前 100 字节
// content 出了作用域，但那 1GB 底层数组还被 firstLine 引用着，收不回来
```

解决方案——强制拷贝一份，断开引用：

```go
// 方式一：Go 1.18 之前
firstLine := string([]byte(content[:100]))

// 方式二：Go 1.18+ 推荐
firstLine := strings.Clone(content[:100])
```

`strings.Clone` 内部就是 `string([]byte(s))`，但语义更清晰——"我要一份独立的副本"。

> 子串和原串共享底层内存，取子串是 O(1)。但大串截小串会导致整个大串无法被 GC。Go 1.18+ 用 `strings.Clone` 断开引用。

---

## string 和 `[]byte` 的互转

### 标准转换：一定发生拷贝

```go
s := "Hello"
strByte := []byte(s)        // ① 分配新内存 + 拷贝
strByte[0] = 'h'            // ② 改的是新内存
fmt.Println(string(strByte)) // ③ 再分配 + 拷贝 -> "hello"
// s 还是 "Hello"，完全没变
```

为什么一定要拷贝？因为两者的内存在完全不同的区域：

- string 的内容在**只读内存区**
- `[]byte` 的内容在**堆上**（可读写）

下图展示了 `[]byte` 转 string 的过程——新申请内存，拷贝数据：

![image-20260704161209935](https://gitee.com/binary-whispers/pic/raw/master///20260704161212024.png)

string 转 `[]byte` 同理——申请新切片空间，把数据拷过去：

![image-20260704161326296](https://gitee.com/binary-whispers/pic/raw/master///20260704161328186.png)

### unsafe 零拷贝：绕开拷贝，但要承担风险

标准转换的拷贝开销在绝大多数场景下可以忽略。但有些极端场景——高频调用、GB 级大字符串处理——拷贝确实会成为瓶颈。

string 和 slice 的 header 内存布局高度相似：

```
string header:               slice header:
+------------------+         +------------------+
| str unsafe.Pointer|         | Data unsafe.Pointer|
+------------------+         +------------------+
| len int           |         | Len int           |
+------------------+         +------------------+
                              | Cap int           |
                              +------------------+
```

string header 是 16 字节，slice header 是 24 字节（多了一个 `Cap`）。直接把 header 强转，就能"骗"过类型系统：

```go
import "unsafe"

// []byte → string：零拷贝，仅构造 header
func BytesToString(b []byte) string {
    return *(*string)(unsafe.Pointer(&b))
}

// string → []byte：零拷贝，仅构造 header
func StringToBytes(s string) []byte {
    return *(*[]byte)(unsafe.Pointer(&s))
}
```

原理简单，但**有三个致命风险**：

1. **修改零拷贝得到的 `[]byte` 会 crash**。string 的底层内存在只读区，通过零拷贝拿到的 `[]byte` 看起来能写，但一写就 SIGSEGV。编译器不会拦住你——崩溃发生在运行时。

2. **原 `[]byte` 被 GC 后，零拷贝出的 string 变成悬空指针**。`BytesToString(buf)` 的返回值还指向 `buf` 的底层数组，一旦 `buf` 被回收，string 的指针就悬空了。

3. **`Cap` 字段是"捡"来的**。string → `[]byte` 时，slice 只有 `Data` 和 `Len`，`Cap` 是从相邻内存"自动补"的。如果相邻内存刚好不是 int 类型，`Cap` 的值不可预测。

标准库的 `strings.Builder.String()` 就在用这个技巧——但它的前提是 Builder 自己持有 `[]byte`，保证底层数组生命周期覆盖 string 的使用周期：

```go
// strings.Builder 源码简化版
func (b *Builder) String() string {
    // buf 是 Builder 持有的 []byte，不会被 GC
    return *(*string)(unsafe.Pointer(&b.buf))
}
```

> unsafe 零拷贝通过强转 header 实现。能用标准转换就用标准转换——安全、可读、省心。非要走 unsafe，必须保证：不写 string 转来的 `[]byte`，不让原 `[]byte` 在 string 存活期间被 GC。

---

## 字符串拼接

### 问题：循环里用 `+=` 为什么慢？

```go
var s string
for i := 0; i < 1000; i++ {
    s += "go"
}
```

每次 `+=` 背后发生了什么？

1. 分配一块新内存（老长度 + "go" 的长度）
2. 把老字符串拷过去
3. 把 "go" 追加到后面
4. 老字符串变成垃圾，等 GC

1000 次循环 = 1000 次分配 + 1000 次全量拷贝。拷贝总量是 O(N²) 的——第 1 次拷 2 字节，第 1000 次拷 2000 字节。越往后越慢。

### 六种方式的性能对比

`demo3/main_test.go` 对六种拼接方式做了 benchmark（1000 次循环，每次拼 "go"）：

```go
// 1. + 操作符
func BenchmarkPlus(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var s string
        for j := 0; j < loopCount; j++ {
            s += subStr // 每次 malloc + copy，O(N²)
        }
    }
}

// 2. fmt.Sprintf（最慢）
func BenchmarkSprintf(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var s string
        for j := 0; j < loopCount; j++ {
            s = fmt.Sprintf("%s%s", s, subStr) // 反射 + 接口装箱 + malloc
        }
    }
}

// 3. bytes.Buffer
func BenchmarkBytesBuffer(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var buf bytes.Buffer
        for j := 0; j < loopCount; j++ {
            buf.WriteString(subStr)
        }
        _ = buf.String() // 最后 String() 会拷贝一次
    }
}

// 4. strings.Builder（推荐）
func BenchmarkStringsBuilder(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var builder strings.Builder
        for j := 0; j < loopCount; j++ {
            builder.WriteString(subStr)
        }
        _ = builder.String() // 零拷贝，unsafe 强转 header
    }
}

// 5. append []byte
func BenchmarkAppend(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var buf []byte
        for j := 0; j < loopCount; j++ {
            buf = append(buf, subStr...)
        }
        _ = string(buf) // 最后转 string 会拷贝一次
    }
}

// 6. strings.Join
func BenchmarkStringsJoin(b *testing.B) {
    slice := make([]string, loopCount)
    for i := 0; i < loopCount; i++ {
        slice[i] = subStr
    }
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _ = strings.Join(slice, "") // 一次预分配，一次拷贝
    }
}
```

输出：

```
BenchmarkPlus-2                3909      288534 ns/op     1063873 B/op      999 allocs/op
BenchmarkSprintf-2             3244      375520 ns/op     1080060 B/op     1999 allocs/op
BenchmarkBytesBuffer-2       158611        7444 ns/op        6080 B/op        7 allocs/op
BenchmarkStringsBuilder-2    339829        3072 ns/op        5368 B/op       10 allocs/op
BenchmarkAppend-2            525447        2490 ns/op        7416 B/op       11 allocs/op
BenchmarkStringsJoin-2       134302        8968 ns/op        2048 B/op        1 allocs/op
```

### 数据说了什么？

| 方式 | 耗时 (ns/op) | 分配次数 | 核心原因 |
|---|---|---|---|
| `append` | 2490 | 11 | runtime 汇编级优化 + 指数扩容，但最后 `string(buf)` 多一次全量拷贝 |
| `strings.Builder` | 3072 | 10 | 底层 `[]byte` + 指数扩容，`String()` 零拷贝 |
| `bytes.Buffer` | 7444 | 7 | 和 Builder 类似，但 `String()` 会全量拷贝一次 |
| `strings.Join` | 8968 | **1** 👑 | 先算总长度，一次性 `make` 足额空间 |
| `+` | 288534 | 999 | 每次 `+=` 都 malloc + copy，O(N²) |
| `fmt.Sprintf` | 375520 | 1999 | 反射解析占位符 + 参数逃逸到堆，分配次数比 `+` 还翻倍 |

几个值得注意的细节：

1. **`+` 和 `Sprintf` 直接崩了**。999 次分配意味着几乎每次循环都在堆上申请新内存。`Sprintf` 翻倍到 1999 次——除了拼接本身，还有格式化参数的接口装箱和逃逸分配。

2. **`Join` 内存控制最好**。1 次分配，就这么干净。因为它先遍历算总长度，一次 `make` 足额空间，然后一次性拷完。

3. **`Builder` 比 `Buffer` 快一倍**。两个底层都是 `[]byte`，唯一的区别是 `String()` —— Builder 用 unsafe 零拷贝，Buffer 老老实实分配 + 拷贝。

4. **`append` 速度第一但有代价**。runtime 内置的 `append` 汇编优化 + 指数扩容让写入极快（容量 < 1024 翻倍，≥ 1024 增加 25%），所以 1000 次循环只扩容了约 10 次。但最后 `string(buf)` 要多拷一次全量数据，所以内存占用比 Builder 略大。

### 怎么选？

> 循环拼接首选 `strings.Builder`（零拷贝 `String()`）。已知 `[]string` 用 `strings.Join`（1 次分配）。两三段直接 `a + b + c`（编译器内部优化掉了中间分配）。禁止循环里 `+=` 和 `fmt.Sprintf`。

提前知道总长度的话，Builder 还可以进一步优化——调用 `Grow(n)` 预分配，连扩容的 10 次分配都省了：

```go
var builder strings.Builder
builder.Grow(2000) // 提前分配 2000 字节，后续 WriteString 不扩容
for i := 0; i < 1000; i++ {
    builder.WriteString("go")
}
```

---

## 易错点

1. **`len(s)` 返回字节数不是字符数**。中文一个字符 3 字节，`len("你好")` = 6。要拿字符数用 `utf8.RuneCountInString` 或 `len([]rune(s))`。

2. **循环里 `+=` 拼接**。每次分配新内存 + 全量拷贝，1000 次循环 = O(N²)。循环拼接永远用 `strings.Builder`。

3. **`s[i]` 拿到的是 byte，不是字符**。`s := "你好"; s[0]` 是 `0xe4`（'你' 的第一个字节），不是 '你'。要按字符位置访问，先转 `[]rune`。

4. **unsafe 零拷贝后写 `[]byte` 直接 crash**。string 底层在只读内存，强转出来的 `[]byte` 写操作 = SIGSEGV。反过来，`[]byte` 转 string 后原 buf 被 GC = 悬空指针。

5. **大串截小串导致内存泄漏**。`small := huge[:100]` 会让整个 `huge` 的底层数组无法 GC。Go 1.18+ 用 `strings.Clone` 断开引用。

6. **`for range` 和 `for i` 遍历行为不同**。前者按 rune 解码，索引是字节偏移量；后者逐字节遍历。中文字符串两个结果天差地别。

7. **string 不能为 nil**。`var s string` 得到的是空字符串 `""`，不是 nil。`s == nil` 编译都过不了。判空用 `len(s) == 0` 或 `s == ""`。

---

## 快问快答

**Q1：Go 的 string 底层结构是什么样的？**

16 字节的结构体：`unsafe.Pointer` 指向底层字节数组，`int` 存长度。没有 `cap`——不可变，不需要扩容。

---

**Q2：为什么 string 设计成不可变的？**

三个原因：① 线程安全——多 goroutine 并发读无需加锁；② 哈希稳定——作为 map key 时哈希值永不变；③ 子串可以安全共享底层内存，O(1) 取子串。

---

**Q3：`len(s)` 和 `len([]rune(s))` 有什么区别？**

`len(s)` = 底层字节数（英文 1、中文 3）。`len([]rune(s))` = 字符数（中英文都算 1 个）。`"hello你好"` → `len()` = 11，`len([]rune())` = 7。

---

**Q4：string 和 `[]byte` 互转一定发生拷贝吗？**

标准方式一定拷贝。string 在只读内存，`[]byte` 在堆上，不同区域必须分配 + 拷贝。不拷贝只能用 unsafe 强转 header，但有只读内存写崩溃和悬空指针的风险。

---

**Q5：循环拼接字符串，`strings.Builder` 为什么比 `+` 快那么多？**

`+` 每次都 malloc + 全量 copy，O(N²)。Builder 底层是 `[]byte`，指数扩容（< 1024 翻倍，≥ 1024 加 25%），最后 `String()` 用 unsafe 零拷贝。1000 次拼接：Builder ~10 次分配，`+` ~1000 次。

---

**Q6：`strings.Builder` 和 `bytes.Buffer` 有什么区别？**

Builder 的 `String()` 用 unsafe 零拷贝；Buffer 的 `String()` 全量拷贝一次。Buffer 实现了 `io.Reader/Writer`，适合 I/O 场景；Builder 更轻量，只做字符串拼接。

---

**Q7：能不能对 string 做 `s[0] = 'x'`？**

不能。编译错误——Go 语言层面禁止了索引赋值。想"修改"只能走 `[]byte` / `[]rune` 中转，改完再转回新 string。

---

**Q8：`strings.Clone` 是干什么的？**

Go 1.18 引入。把子串数据强制拷贝一份，新字符串拥有独立底层内存。解决"大串截小串导致内存泄漏"的问题。内部实现就是 `string([]byte(s))`。

---

**Q9：string 能跟 nil 比较吗？**

不能，编译错误。string 不是引用类型，不能为 nil。判空用 `s == ""` 或 `len(s) == 0`。

---

**Q10：`for _, v := range s` 中 v 是什么类型？索引 i 代表什么？**

v 是 `rune`（`int32`），代表 Unicode 码点。i 是当前 rune 的**字节偏移量**，不是字符位置索引。`"你好Go"` 中 '好' 的 i=3（'你' 占 3 字节），不是 1。

---

## 一句话总结

**string = `{pointer, len}`，不可变，`len` 是字节数不是字符数。抓住这三个根基，剩下的遍历、转换、子串、拼接性能差异，全能从这三个根基推导出来。**
