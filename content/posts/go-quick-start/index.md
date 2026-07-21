---
title: "一文带你快速上手 Go"
date: 2026-07-21T23:43:47+08:00
lastmod: 2026-07-21T23:48:21+08:00
draft: false
status: "evergreen"
topic: "golang"
categories: ["Go 语言"]
tags: ["Go", "并发", "字符串", "切片"]
series: ["Go 底层原理"]
seriesOrder: 3
featured: false
summary: "这篇文章基于当前目录里的 Go 示例代码整理，目标是复习 Go 基础语法和并发基础，不做百科全书式展开。没有写过的内容不强行扩展 完整代码在这：https://github.com/WoAiXueXiHa/golang"
---

这篇文章基于当前目录里的 Go 示例代码整理，目标是复习 Go 基础语法和并发基础，不做百科全书式展开。没有写过的内容不强行扩展

完整代码在这：https://github.com/WoAiXueXiHa/golang


## 1. Go 程序的基本形态

### 解决什么问题

一个 Go 程序至少要回答三件事：这段代码属于哪个包、依赖哪些标准库、程序从哪里开始执行。最常见的可执行程序形态就是 `package main` + `func main()`。

### 代码示例

```go
package main

import "fmt"

func fact(n int) int {
	if n == 0 {
		return 1
	}
	return n * fact(n-1)
}

func main() {
	fmt.Println(fact(5))
}
```

### 关键语法

`package` 声明当前文件所在的包。`main` 包是可执行程序入口包，`func main()` 是程序入口函数。

`import` 引入其他包。比如 `fmt` 是标准库里的格式化输入输出包。

函数用 `func` 声明，参数类型写在参数名后面，返回值类型写在参数列表后面。上面的 `fact(n int) int` 表示接收一个 `int`，返回一个 `int`。

对于闭包示例。闭包是“能捕获外层变量的函数值”，适合封装一小段状态：

```go
func inSeq() func() int {
	i := 0
	return func() int {
		i++
		return i
	}
}
```

记住核心：
> Go 程序从 `main` 开始，把逻辑拆成小函数；函数也可以作为值返回，并带着它捕获的变量继续工作。

### 常见坑

递归函数必须有终止条件，否则会无限调用。闭包捕获的是变量本身，不是某一刻的值；在循环里配合 goroutine 使用时，要格外注意循环变量捕获问题。

## 2. Go 的数据组织方式

### struct：把一组字段组织成一个值

#### 解决什么问题

当一个对象有多个字段，比如人的姓名和年龄，用零散变量会很乱。`struct` 用来声明一组字段，表达一个具体的数据形状。

#### 代码演示

```go
package main

import "fmt"

type person struct {
	name string
	age  int
}

func newPerson(name string) *person {
	p := person{name: name}
	p.age = 20
	return &p
}

func main() {
	s := person{name: "Alice", age: 18}
	fmt.Println(s.name)

	sp := &s
	sp.age = 20
	fmt.Println(s.age)
}
```

#### 关键语法

`type person struct { ... }` 定义结构体类型。结构体字面量可以按字段顺序写，也可以用 `name: value` 指定字段。

`&s` 取地址，得到结构体指针。Go 访问结构体指针字段时可以直接写 `sp.age`，编译器会自动解引用。

函数返回局部变量地址是合法的。Go 会根据变量生命周期决定它应该放在哪里，并由垃圾回收管理。

#### 常见坑

`sq := s` 会复制整个结构体，之后 `sq` 和 `s` 是两个独立的值。`sp := &s` 保存的是地址，通过 `sp` 修改字段会影响原来的 `s`。

### methods：把行为绑定到类型上

#### 解决什么问题

函数可以处理任何参数，但有些行为明显属于某个类型，比如矩形的面积。方法就是带接收者的函数，用来描述某个类型自己的行为。

#### 代码示例

```go
package main

import "fmt"

type rect struct {
	width, height int
}

func (r *rect) area() int {
	return r.width * r.height
}

func (r rect) perim() int {
	return 2*r.width + 2*r.height
}

func main() {
	r := rect{width: 10, height: 5}
	fmt.Println(r.area())
	fmt.Println(r.perim())
}
```

#### 关键语法

`func (r *rect) area() int` 里的 `(r *rect)` 是接收者。接收者放在 `func` 和方法名之间。

值接收者会复制一份值，适合只读场景。指针接收者拿到地址，适合修改对象，或者避免复制较大的结构体。

#### 常见坑

方法不能靠“值接收者”和“指针接收者”重载。比如同一个类型不能同时定义 `func (d Dog) Speak()` 和 `func (d *Dog) Speak()`。

### interfaces：用方法集合描述能力

#### 解决什么问题

如果一个函数只关心“这个对象会不会说话”，就不应该依赖具体的 `Dog` 或 `Cat`。接口用一组方法签名描述能力。

#### 代码实例

```go
package main

import "fmt"

type Speaker interface {
	Speak() string
}

type Dog struct{ Name string }

func (d Dog) Speak() string {
	return d.Name + ": wang"
}

func MakeSpeak(s Speaker) {
	fmt.Println(s.Speak())
}

func main() {
	MakeSpeak(Dog{Name: "Dahuang"})
}
```

#### 关键语法

接口是一组方法签名。Go 类型不需要显式声明“实现了某接口”，只要方法集合匹配，就自动满足接口。

`any` 等价于 `interface{}`，表示可以接收任何值。但进入函数后，静态类型就是 `any`，不能直接调用原类型的方法。需要类型断言：

```go
func PrintDog(v any) {
	dog, ok := v.(Dog)
	if !ok {
		fmt.Println("not Dog")
		return
	}
	fmt.Println(dog.Name)
}
```

接口也可以嵌套，比如把 `Reader` 和 `Writer` 组合成 `ReadWriter`。

#### 常见坑

类型断言不要直接写 `dog := v.(Dog)`，实际类型不匹配会 panic。优先使用 `dog, ok := v.(Dog)`。

### map：按 key 快速查找

#### 解决什么问题

当你需要通过名字、ID 这类 key 快速找到值时，用 `map`。它表达的是“键到值”的映射。

#### 代码示例

```go
package main

import "fmt"

func main() {
	m := make(map[string]int)
	m["k1"] = 7

	v, ok := m["k1"]
	fmt.Println(v, ok)

	delete(m, "k1")
}
```

#### 关键语法

`make(map[string]int)` 创建一个 key 为 `string`、value 为 `int` 的 map。

读取 map 可以用双返回值：`v, ok := m[key]`。`ok` 表示 key 是否存在。

`delete(m, key)` 删除元素，删除不存在的 key 也是安全的。

#### 常见坑

不要只用返回值判断 key 是否存在。比如 `map[string]int` 中，不存在的 key 会读到 `0`，但真实值也可能刚好是 `0`，所以要看第二个返回值 `ok`。

### slice：可变长度序列

#### 解决什么问题

数组长度固定，日常更常用的是可追加、可切片的序列。`slice` 是 Go 里最常用的数据容器之一。

#### 代码示例

```go
package main

import "fmt"

func main() {
	s := make([]string, 3)
	s[0] = "a"
	s[1] = "b"
	s[2] = "c"

	s = append(s, "d", "e")
	c := make([]string, len(s))
	copy(c, s)

	fmt.Println(s[1:3])
	fmt.Println(c)
}
```

#### 关键语法

`make([]string, 3)` 创建长度为 3 的切片。`append` 追加元素，返回新的切片，所以通常写回原变量。

`s[1:3]` 是左闭右开区间，包含索引 1，不包含索引 3。

`copy(dst, src)` 把元素复制到另一个切片。

#### 常见坑

切片赋值通常只是复制切片头部，不等于复制所有元素。需要独立数据时，用 `make` + `copy`。

### range：统一遍历 slice、map、string、channel

#### 解决什么问题

不同容器有不同访问方式。`range` 给了一个统一的遍历写法。

#### 代码示例

```go
package main

import "fmt"

func main() {
	nums := []int{2, 3, 4}
	sum := 0
	for _, num := range nums {
		sum += num
	}
	fmt.Println(sum)

	kvs := map[string]string{"a": "apple", "b": "banana"}
	for k, v := range kvs {
		fmt.Println(k, v)
	}
}
```

#### 关键语法

遍历切片时，`range` 返回索引和值。只要值不要索引，可以用 `_` 忽略索引。

遍历 map 时，返回 key 和 value。遍历字符串时，返回字节索引和 `rune`。

#### 常见坑

`range` 得到的值通常是元素副本。修改 `v` 不会修改原切片元素。要修改原切片，使用索引：

```go
for i := range nums {
	nums[i] *= 10
}
```

map 遍历顺序是不固定的，不要依赖顺序。遍历时删除 slice 元素容易漏删，稳定做法是倒序删除或构造新切片。

### rune：按 Unicode 字符处理字符串

#### 解决什么问题

中文字符不是一个字节。如果直接按 `len(s)` 和 `s[i]` 遍历，你拿到的是字节，不是字符。`rune` 表示一个 Unicode 码点，适合按字符理解字符串。

#### 代码示例

```go
package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {
	const s = "你好 Go"
	fmt.Println(len(s))
	fmt.Println(utf8.RuneCountInString(s))

	for i, r := range s {
		fmt.Printf("%#U starts at %d\n", r, i)
	}
}
```

#### 关键语法

`len(s)` 返回字节数，不是字符数。`utf8.RuneCountInString(s)` 返回 UTF-8 字符串中的 rune 数量。

`for i, r := range s` 按 rune 遍历字符串，`i` 是该 rune 起始的字节索引。

#### 常见坑

不要把字节索引当成字符下标。比如中文一个字通常占 3 个字节，`range` 返回的索引可能是 `0, 3, 6...`。

### enums：用 iota 表达有限状态

#### 解决什么问题

当状态只有固定几个值时，不要到处散落字符串或魔法数字。用自定义类型加常量，可以把状态范围收紧。

#### 代码示例

```go
package main

import "fmt"

type ServerState int

const (
	StateIdle ServerState = iota
	StateConnected
	StateError
	StateRetrying
)

func transition(s ServerState) ServerState {
	switch s {
	case StateIdle:
		return StateConnected
	case StateConnected, StateRetrying:
		return StateIdle
	case StateError:
		return StateError
	default:
		panic(fmt.Errorf("unknown state: %d", s))
	}
}
```

#### 关键语法

`iota` 在 `const` 块中从 0 开始逐行递增，适合生成一组枚举值。

给枚举类型实现 `String()` 方法，可以让打印结果更可读。比如我的代码用 `map[ServerState]string` 做状态名映射。

#### 常见坑

Go 没有封闭枚举。`ServerState(100)` 这样的值仍然能构造出来，所以 `switch` 里保留 `default` 很重要。

## 3. Go 的错误处理方式

### error：错误是普通返回值

#### 解决什么问题

函数失败时，调用方需要知道失败原因，并决定下一步怎么处理。Go 的常规做法是把错误作为 `error` 返回值返回，而不是默认抛异常。

#### 代码示例

```go
package main

import (
	"errors"
	"fmt"
)

var ErrTaskNotFound = errors.New("task not found")

func findTask(id int64) error {
	if id == 1001 {
		return fmt.Errorf("query db failed: %w", ErrTaskNotFound)
	}
	return nil
}

func main() {
	if err := findTask(1001); err != nil {
		if errors.Is(err, ErrTaskNotFound) {
			fmt.Println("task not found")
		}
	}
}
```

#### 关键语法

`error` 是一个普通接口值。函数返回 `nil` 表示没有错误，返回非 `nil` 表示失败。

`errors.New` 创建固定错误。`fmt.Errorf("...: %w", err)` 包装错误并保留错误链。`errors.Is` 用来判断错误链里是否包含某个目标错误。

也可以自定义错误类型：

```go
type TaskError struct {
	Op     string
	TaskID int64
	Err    error
}

func (e *TaskError) Error() string {
	return fmt.Sprintf("op=%s task_id=%d: %v", e.Op, e.TaskID, e.Err)
}

func (e *TaskError) Unwrap() error {
	return e.Err
}
```

实现 `Error() string` 就满足 `error` 接口。实现 `Unwrap()` 后，`errors.Is` 和 `errors.As` 可以沿着错误链继续查找。

#### 常见坑

不要用 `err.Error()` 的字符串判断错误类型。字符串是给人看的，不适合作为程序判断依据。

`%v` 只是格式化文本，不会保留错误链；需要调用方识别底层错误时，用 `%w`。

### panic、defer、recover：异常退出和收尾

#### 解决什么问题

有些错误表示程序已经无法按当前路径继续，比如未知状态。`panic` 会让当前 goroutine 异常退出。退出前，Go 会执行已经注册的 `defer`。

#### 代码示例

```go
package main

import "fmt"

func run() {
	defer func() {
		if err := recover(); err != nil {
			fmt.Println("catch panic:", err)
		}
	}()

	fmt.Println("begin")
	panic("crash")
}

func main() {
	run()
}
```

#### 关键语法

`defer` 把函数调用延迟到外层函数返回前执行，常用于关闭文件、释放锁、记录日志等收尾工作。

`panic` 会中断当前执行路径，并在退出前依次执行已经注册的 `defer`。

`recover` 只能在 `defer` 调用的函数里生效，用来接住当前 goroutine 中正在传播的 panic。

#### 常见坑

`defer` 的普通函数参数会立刻求值：

```go
x := 10
defer fmt.Println(x)
x = 20
```

最后打印的是 `10`。如果想在函数退出时再读取变量，用匿名函数：

```go
defer func() {
	fmt.Println(x)
}()
```

另一个坑是：`recover` 只能捕获同一个 goroutine 里的 panic。主 goroutine 里的 `recover` 捕不到子 goroutine 的 panic。

## 4. Go 的并发基础

### goroutine：启动并发执行的函数

#### 解决什么问题

当多个任务可以同时做时，不必一个接一个等待。Go 用 `go` 关键字启动 goroutine。goroutine 是 Go 管理的轻量级并发执行单元。

#### 代码示例

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup

	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			fmt.Println("worker:", id)
		}(i)
	}

	wg.Wait()
}
```

#### 关键语法

`go f()` 启动一个新的 goroutine 执行函数 `f`。

`sync.WaitGroup` 用来等待一组 goroutine 完成。`Add(1)` 增加计数，`Done()` 完成一个，`Wait()` 阻塞等待计数归零。

#### 常见坑

`main` 函数结束，整个程序就结束，没执行完的 goroutine 不会被自动等待。

循环里启动 goroutine 时，把循环变量作为参数传进去，避免闭包捕获同一个变量带来的混乱。

### channel：在 goroutine 之间传数据和同步

#### 解决什么问题

并发程序不能只靠共享变量。`channel` 是 goroutine 之间传递数据和同步的管道。它让数据从一个 goroutine 流向另一个 goroutine。

#### 代码示例

```go
package main

import "fmt"

func main() {
	ch := make(chan int)

	go func() {
		ch <- 10
	}()

	x := <-ch
	fmt.Println(x)
}
```

#### 关键语法

`make(chan int)` 创建无缓冲 channel。`ch <- 10` 发送数据，`x := <-ch` 接收数据。

无缓冲 channel 发送和接收必须同时准备好。发送方会等接收方，接收方也会等发送方。

有缓冲 channel 用 `make(chan int, 2)` 创建。缓冲区没满时发送不阻塞，缓冲区不空时接收不阻塞。

`close(ch)` 关闭 channel。关闭后还能读出缓冲区剩余数据；读完后再读会得到零值和 `false`：

```go
v, ok := <-ch
```

`for v := range ch` 会一直读，直到 channel 被关闭并且数据读完。

#### 常见坑

向已关闭的 channel 发送数据会 panic，重复关闭也会 panic。通常由发送方负责关闭 channel。

如果 `for range` 读 channel，但没有任何 goroutine 关闭它，循环会一直等下去。

### select：同时等待多个 channel

#### 解决什么问题

真实任务经常要同时等多个事件：结果返回、超时、用户取消、退出信号。`select` 用来同时等待多个 channel，哪个先就绪就执行哪个分支。

#### 代码示例

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	resultCh := make(chan string)

	go func() {
		time.Sleep(2 * time.Second)
		resultCh <- "done"
	}()

	select {
	case result := <-resultCh:
		fmt.Println(result)
	case <-time.After(time.Second):
		fmt.Println("timeout")
	}
}
```

#### 关键语法

`select` 的每个 `case` 是一次 channel 发送或接收。没有任何 case 就绪时，`select` 会阻塞。

加上 `default` 后，`select` 可以变成非阻塞检查：

```go
select {
case queue <- task:
	fmt.Println("queued")
default:
	fmt.Println("queue full")
}
```

#### 常见坑

带 `default` 的 `select` 不会等待。如果你本来想等结果，却加了 `default`，程序会立刻走默认分支。

`select` 只执行一次。如果要持续监听多个 channel，通常需要放在 `for` 循环里。

### Mutex：保护共享变量

#### 解决什么问题

多个 goroutine 同时读写同一个变量，会产生数据竞争。`sync.Mutex` 用来保护临界区，让同一时刻只有一个 goroutine 能修改共享数据。

#### 代码示例

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var mu sync.Mutex
	var wg sync.WaitGroup
	count := 0

	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			mu.Lock()
			defer mu.Unlock()
			count++
		}()
	}

	wg.Wait()
	fmt.Println(count)
}
```

#### 关键语法

`mu.Lock()` 加锁，`mu.Unlock()` 解锁。通常在加锁后马上写 `defer mu.Unlock()`，保证函数退出前释放锁。

#### 常见坑

忘记解锁会让其他 goroutine 永远拿不到锁。重复加同一把锁，或者两把锁互相等待，也可能导致死锁。

### RWMutex：读多写少的缓存

#### 解决什么问题

如果一个数据读很多、写很少，用普通互斥锁会让多个读也互相等待。`sync.RWMutex` 允许多个读同时进行，但写入时会独占。

#### 代码示例

```go
type Cache struct {
	mu   sync.RWMutex
	data map[string]string
}

func (c *Cache) Get(key string) string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.data[key]
}

func (c *Cache) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = value
}
```

#### 关键语法

读操作用 `RLock/RUnlock`，写操作用 `Lock/Unlock`。多个读锁可以同时持有；写锁会排斥读和写。

#### 常见坑

不要在持有读锁时直接写数据。读锁只保护读，写数据必须用写锁。

### Once：只初始化一次

#### 解决什么问题

配置、连接、全局对象这类资源只应该初始化一次，但可能被多个 goroutine 同时触发。`sync.Once` 保证函数只执行一次。

#### 代码示例

```go
var once sync.Once
var config map[string]string

func loadConfig() {
	config = map[string]string{"env": "dev"}
}

func GetConfig() map[string]string {
	once.Do(loadConfig)
	return config
}
```

#### 关键语法

`once.Do(fn)` 会执行 `fn`，并保证即使多个 goroutine 同时调用，也只有一个会真正执行初始化函数。

#### 常见坑

`sync.Once` 一旦执行过，就不会再执行第二次。它适合“一次性初始化”，不适合需要重载、刷新、重试多轮的逻辑。

### atomic：简单变量的原子操作

#### 解决什么问题

简单计数器、开关状态这类变量，不一定需要完整互斥锁。`sync/atomic` 提供原子读写和加减。

#### 代码示例

```go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

func main() {
	var count atomic.Int64
	var wg sync.WaitGroup

	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			count.Add(1)
		}()
	}

	wg.Wait()
	fmt.Println(count.Load())
}
```

#### 关键语法

`Add` 原子加，`Load` 原子读，`Store` 原子写，`Swap` 替换并返回旧值，`CompareAndSwap` 在旧值匹配时更新。

#### 常见坑

atomic 适合简单变量，不适合保护一组相关字段的不变式。多个字段需要一起更新时，用锁更清楚。

### sync.Map：并发安全的 map

#### 解决什么问题

普通 map 并发读写会出问题。`sync.Map` 提供并发安全的读写能力，适合 key 写一次读很多次，或多个 goroutine 操作不同 key 的场景。

#### 代码示例

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var m sync.Map

	m.Store("go", 100)
	v, ok := m.Load("go")
	if ok {
		fmt.Println(v.(int))
	}

	m.Delete("go")
}
```

#### 关键语法

`Store` 写入，`Load` 读取，`Delete` 删除，`LoadOrStore` 有就读、没有就写，`Range` 遍历。

因为 `sync.Map` 的 key 和 value 是 `any`，取出后通常需要类型断言。

#### 常见坑

`sync.Map` 不是普通 map 的默认替代品。单 goroutine 或需要复杂业务不变式时，普通 map 加锁通常更直观。

## 6. Go 的超时与定时任务

### context：传递取消信号和超时

#### 解决什么问题

一个请求可能启动多个函数和 goroutine。用户取消、请求超时、上游结束时，下面的任务也应该停止。`context.Context` 用来在调用链中传递取消信号、截止时间和请求级值。

#### 代码示例

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func callAI(ctx context.Context) (string, error) {
	select {
	case <-time.After(3 * time.Second):
		return "AI answer", nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	answer, err := callAI(ctx)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(answer)
}
```

#### 关键语法

`context.Background()` 常作为根 context。`context.WithCancel` 创建可主动取消的 context。`context.WithTimeout` 创建超时后自动取消的 context。`ctx.Done()` 返回一个 channel，取消或超时时会关闭。`ctx.Err()` 返回取消原因。

对于 `context.WithValue`，它适合传递请求级信息，例如用户 ID。key 建议使用自定义类型，避免和其他包冲突。

#### 常见坑

创建带取消能力的 context 后，要调用 `cancel`。即使用了超时，也建议 `defer cancel()`，及时释放关联资源。

不要把 `context.Value` 当成普通参数传递工具。业务必需参数应该显式写进函数参数。

### Timer、Ticker、time.After、time.AfterFunc

#### 解决什么问题

有些任务只需要到点执行一次，比如订单超时取消；有些任务需要周期执行，比如定时扫描待处理任务。Go 的 `time` 包提供了这些基础定时能力。

#### 代码示例

```go
package main

import (
	"fmt"
	"time"
)

func main() {
	timer := time.NewTimer(time.Second)
	<-timer.C
	fmt.Println("timer fired")

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	done := time.After(3 * time.Second)
	for {
		select {
		case <-ticker.C:
			fmt.Println("tick")
		case <-done:
			return
		}
	}
}
```

#### 关键语法

`time.NewTimer(d)` 创建一次性定时器，到时间后会在 `timer.C` 上发送一个时间值。`timer.Stop()` 可以尝试停止还没触发的定时器。`timer.Reset(d)` 可以重置计时。

`time.After(d)` 返回一个只读 channel，到时间后收到一个值，常用于 `select` 超时分支。

`time.AfterFunc(d, fn)` 到时间后自动执行函数，并返回一个 timer。

`time.NewTicker(d)` 创建周期性定时器，每隔一段时间在 `ticker.C` 上发送一次时间值。

本质句：Timer 是一次性定时器，Ticker 是周期性定时器，context 更适合表达一条调用链的取消和超时。

#### 常见坑

`Ticker` 用完要 `Stop()`，否则它会继续计时。`Timer.Stop()` 返回 `false` 表示它可能已经触发或已经停止，写复杂重置逻辑时要谨慎处理。

## 7. 一个 worker pool 串起并发知识

### 解决什么问题

如果有很多任务，但不想为每个任务无限制地启动 goroutine，可以启动固定数量的 worker。任务从 `jobs` channel 进入，worker 从里面取任务，处理后把结果写入 `results`。这就是 worker pool 的基本形态。

### 代码示例

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

type Job struct {
	ID int
}

func worker(id int, jobs <-chan Job, results chan<- int, wg *sync.WaitGroup) {
	defer wg.Done()

	for job := range jobs {
		fmt.Println("worker", id, "started job", job.ID)
		time.Sleep(time.Second)
		results <- job.ID * 2
	}
}

func main() {
	const numJobs = 5
	const numWorkers = 3

	jobs := make(chan Job, numJobs)
	results := make(chan int, numJobs)

	var wg sync.WaitGroup
	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go worker(w, jobs, results, &wg)
	}

	for j := 1; j <= numJobs; j++ {
		jobs <- Job{ID: j}
	}
	close(jobs)

	wg.Wait()
	close(results)

	for result := range results {
		fmt.Println("result:", result)
	}
}
```

### 关键语法

任务从哪里来：`main` 负责生产任务，把 `Job` 写入 `jobs`，写完后关闭 `jobs`。

worker 如何消费任务：每个 worker 都执行 `for job := range jobs`。只要 `jobs` 没关闭，worker 就会继续等待任务；`jobs` 关闭并且数据读完后，循环自然退出。

结果如何收集：worker 只负责向 `results` 发送结果。主流程等待所有 worker 结束后关闭 `results`，再用 `for range` 读完所有结果。

### 常见坑

不要由多个 worker 关闭同一个 `results` channel。通常由“知道所有 worker 已经结束”的 goroutine 或主流程关闭它。

`jobs` 不关闭，worker 的 `for range` 就不会退出。`results` 如果没有足够缓冲，且没有 goroutine 同时接收，也可能让 worker 卡在发送结果上。

## 8. 总结：Go 基础学习路线

| 知识点 | 解决的问题 | 常见使用场景 | 当前掌握程度 |
| --- | --- | --- | --- |
| package / import / main | 组织可执行程序入口 | 命令行 demo、学习样例 | 基础用法 |
| function / return | 封装可复用逻辑 | 普通函数、递归、错误返回 | 基础用法 |
| closure | 保存一小段状态 | 序列号生成器、回调函数 | 基础用法 |
| struct | 组织字段 | 业务对象、配置对象 | 基础用法 |
| methods | 把行为绑定到类型 | 面积计算、对象修改 | 基础用法 |
| interfaces / any | 用方法集合描述能力 | 多类型统一调用、类型断言 | 基础到组合用法 |
| map | 按 key 查找值 | 缓存、索引、状态名映射 | 基础用法 |
| slice | 可变长度列表 | 追加、复制、二维切片 | 基础用法 |
| range | 遍历容器 | slice、map、string、channel | 覆盖常见坑 |
| rune / utf8 | 正确处理 Unicode 字符 | 中文字符串遍历、字符计数 | 基础用法 |
| iota enum | 表达有限状态 | 服务状态流转 | 基础用法 |
| error / errors.Is / errors.As | 把失败作为返回值处理 | 哨兵错误、自定义错误、错误链 | 较完整基础 |
| panic / defer / recover | 异常退出和退出前收尾 | 资源释放、兜底恢复 | 基础用法 |
| goroutine | 并发执行函数 | 并发 worker、后台任务 | 基础用法 |
| channel | goroutine 间传值和同步 | 任务队列、结果返回、信号通知 | 覆盖阻塞和关闭 |
| select | 同时等待多个 channel | 超时、取消、非阻塞投递 | 基础用法 |
| Mutex / RWMutex | 保护共享数据 | 计数器、读多写少缓存 | 基础用法 |
| Once | 保证只初始化一次 | 配置懒加载、全局对象初始化 | 基础用法 |
| atomic | 简单变量原子操作 | 计数器、状态位 | 基础用法 |
| sync.Map | 并发安全 map | 写少读多、不同 key 并发访问 | 基础用法 |
| context | 传递取消和超时 | 请求超时、主动停止 goroutine | 基础用法 |
| Timer / Ticker | 定时和周期任务 | 超时取消、定时扫描 | 基础用法 |
| worker pool | 限制并发、批量处理任务 | 固定 worker 消费任务队列 | 基础串联 |

## 官方参考资料

- [A Tour of Go](https://go.dev/tour/)
- [Effective Go](https://go.dev/doc/effective_go)
- [The Go Blog](https://go.dev/blog/)
- [Go Packages 文档](https://pkg.go.dev/)
- [The Go Programming Language Specification](https://go.dev/ref/spec)
