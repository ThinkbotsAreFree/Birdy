
![](http://noisett.lang.free.fr/birdy.png)

# Birdy

Birdy is
* a message oriented virtual machine
* a real-time **chatbot engine**
* designed to be as small as possible while still being powerful and easy to use.

A declarative language, based on special characters instead of keywords, is used to describe a set of nodes called "peers", which communicate asynchronously through a **publish/subscribe** system.

Here is a complete list of the 18 characters with special meaning.

```
    |       peer

    #0      capture wildcard
    &0      insert wildcard

    @       on channel
    >       publish
    <       reply

    +       if match
    -       if no match

    ?       if code matches
    !       if code does not match

    {       subscribe
    }       unsubscribe

    $       store in code
    %       remove from code

    _       do nothing

    *       create peer

    ~       die

    []      escape block
```

## Overview

### Pub/sub

A Birdy program is made of a lot of very small reactive agents. We call these agents "peers".

During execution of the program, peers continuously receive and send messages to one another, asynchronously, and anonymously.

The Wikipedia [article](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) about the pub/sub pattern gives the following definition.
> In software architecture, publish/subscribe is a messaging pattern where senders of messages, called publishers, do not program the messages to be sent directly to specific receivers, called subscribers, but instead categorize published messages into classes without knowledge of which subscribers, if any, there may be. Similarly, subscribers express interest in one or more classes and only receive messages that are of interest, without knowledge of which publishers, if any, there are.

This pattern is usually employed as glue between software components. But in Birdy, pub/sub is the core architecture.

## Structure of a peer definition

### Command format

A peer definition is mainly a succession of **commands**. Commands are the smallest building blocks of Birdy programs.

A command starts with a special character (the instruction), followed by a string of non-special characters (the argument). For example in the following code line:

```
+ hey @ global > hello world
```
We have 3 commands:

- `+ hey` -> if the received message matches the pattern "hey"

- `@ global` -> choose "global" as emission channel

- `> hello world` -> publish a "hello world" message

### Peer definition format

A peer definition starts with a vertical bar `|` immediately followed by a channel pattern, followed by commands. The following line is a valid and complete definition of a peer.
```
| from user + hi there @ to user > hello world
```

At startup, this peer is initially configured to receive all messages published on the `from user` channel.

### Escape blocks

Square brackets can be used to delimit blocks of uninterpreted characters. These blocks are a way to embed special characters in arguments:
```
+ I love you > sweet [<3]
```
Here, the `<` character isn't interpreted as a *reply* command, but simply as part of the message to be published.

The enclosing square brackets are removed from the argument. In the previous example, the published message is not `sweet [<3]` but simply `sweet <3`.

Square brackets are nestable. In that case, they have to be balanced.
```
> You can [nest [balanced] square brackets] too
```
This would publish `You can nest [balanced] square brackets too`. As you can see, only the outer square brackets are removed.

## Execution of a peer's program

### Command categories

There are **action-commands** and **condition-commands**.

A condition-command performs a logical test. `+ - ? !` are condition-commands.
 
An action-command performs an action. `@ > < { } $ % _ * ~` are action-commands.

### Wildcards

In arguments, the *capture wildcard* character `#` can be used to capture characters in condition-commands, and the *insert wildcard* character can be used to insert previously captured characters in any command.
```
+ user wants #1 > is &1 available
```
If a peer with this code receives a message "user wants another topic", it will publish a message "is another topic available".

The character immediately following `#` and `&` is the wildcard identifier. It can be any non-special character, like a digit or a letter.

### Parentheses in glob patterns

Pattern matching in Birdy works almost like file glob patterns, with `#0` instead of `*`. But there's a key difference.

Pattern matching in Birdy is **parenthese-sensitive**. If an opening parenthese is captured, the corresponding closing parenthese must also be captured. If an opening parenthese is not captured, the corresponding closing parenthese cannot be captured.

In other words, if a capture has parentheses, they are necessarily balanced.

This feature makes structured messaging possible and easy: since we can work with s-expression based messages, we can work with any kind of data structure.

### Control flow

When a peer receives a message, the message goes through all the peer's commands, one by one, in order.

When the message flows through an action-command, the action is executed.

When it flows through a condition-command, a test is performed. If the test fails, the flow jumps to the next series of condition-commands.
```
+ if1 + if2 @ ch1 > msg1 + if3 + if4 > msg2
```
If the `+ if1` test fails, control jumps directly to the `+ if 3` test. Then, if both `+ if3` and `+ if4` succeed, the `> msg2` action-command is executed.

### Formulae

It is possible to include arithmetical formulae in command arguments.

A formula has to be enclosed in square brackets, and the character immediately following the opening square bracket has to be an equal sign `=`.
```
| counter
+ found #1 new items
? [_] (total: #2)
% [_] (total: &2)
$ [_] (total: [= &1 + &2])
_ (total: 5)
```
The last command of this peer is a *do nothing* command. The *do nothing* command can be used as data storage. In this example, it is employed to save an item counter.

When this peer receives a `found 3 new items` message, the number `3` is stored in the `#1` wildcard.

Then the peer scans its own code to find a `_ (total: #2)` fragment. It finds `_ (total: 5)`, so the number `5` is stored in the `#2` wildcard.

Then, it removes `_ (total: 5)` from its own code.

Finally, it stores a new code fragment `_ (total: ` followed by the result of the formula `[= &1 + &2]` followed by a closing parenthese `)`.

In formulae, unlike in escape blocks, wildcards are replaced by their content. The formula becomes `[= 3 + 5]`. Hence, the code fragment being stored is `_ (total: 8)`.

### State persistence

The whole state of a peer remains unchanged between receptions of 2 messages. The emission channel and wildcards' content won't be deleted after a message has been treated.
```
| global
+ save #1 > done
+ give it > I saved &1
```
After this peer receives a `save foo` message, wildcard `#1` will contain `foo`. Then, if it receives a `give it` message, it will publish `I saved foo`.

## The network

### Channels

Messages are published on channels. Channels are simply **strings**.

Peers receive only messages that were published on channels they subscribed to.

To subscribe to a new channel, a peer should execute the *subscribe* command `{`. To unsubscribe, the *unsubscribe* command `}` should be executed. Obviously, curly braces don't have to be balanced, because these two commands are independent.
```
| global + please listen to #1 { dynamic/&1
```
At startup, this peer is configured to listen to the `global` channel.

If it receives a `please listen to subcons` message, it will subscribe to the `dynamic/subcons` channel, and will start receiving messages published on this channel too.

### Channel patterns

It is possible to configure a peer to listen to every channel that matches a pattern.

For example, `{ ch/#4` means "subscribe to every channel that matches `ch/#4`". With this subscription, when a message is received on channel `ch/bar`, the wildcard `#4` will contain `bar`.

### Peers creation

The *create peer* command `*` takes its argument and makes a new peer out of it.
```
| global
+ make greeter #1
* [| from user + ]&1[ > hello]
```
When this peer receives a `make greeter hey` message, it will create the following peer:
```
| from user + hey > hello
```
Notice how we didn't escape the `&1` wildcard in the *create peer* command.

### Peers death

The *die* command `~` allows a peer to delete itself.

The argument of the *die* command is the "testament" of the peer: it is a message that will be emitted just before the peer is deleted.

## Commands detailed

### @ on channel

The *on channel* command modifies the current **emission channel** of the peer.

By default, a peer publishes its messages on the `global` channel.

A message can only be published on 1 channel.

### > publish

The *publish* command publishes a message on the current emission channel.

All peers that subscribed to this channel will receive the message.

### < reply

The *reply* command sends a message only to the peer that published the received message.

### + if match

The *if match* command is a condition-command that succeeds only if the received message matches a pattern.

If it succeeds, the wildcards used in the pattern will contain captured characters.

### - if no match

The *if no match* command is a condition-command that succeeds only if the received message doesn't match a pattern.

If it fails, the wildcards used in the pattern will contain captured characters.

### ? if code matches

The *if code matches* command is a condition-command that succeeds only if the peer's source code matches a pattern.

If it succeeds, the wildcards used in the pattern will contain captured characters.

### ! if code does not match

The *if code does not match* command is a condition-command that succeeds only if the peer's source code doesn't match a pattern.

If it fails, the wildcards used in the pattern will contain captured characters.

### { subscribe

The *subscribe* command makes the peer listen to a channel, or to every channel matching a pattern.

### } unsubscribe

The *unsubscribe* command makes the peer stop listening to a channel, or to every channel matching a pattern.

### $ store in code

The *store in code* command appends a string to the peer's source code.

### % remove from code

The *remove from code* command removes every part of the peer's source code that matches a pattern.

### _ do nothing

The *do nothing* command does nothing. Its purpose is to store data in the peer's source code, or to separate series of condition-commands without doing anything.

### * create peer

The *create peer* command creates a new peer. The argument will be the new peer's  source code.

### ~ die

The *die* command deletes the peer which executes it. The argument will be the last message published by the peer before it disappears.

## Math operators

```
    precedence      syntax          name
    ==========      ======          ====
    
    1               ( x )           grouping
    1               | x |           abs
    
    2               x!              factorial
    2               ~x              not
    2               -x              unary minus
    2               _x              truncate
    
    3               x ^ y           power
    3               x V y           root
    
    4               x * y           mul
    4               x / y           div
    4               x % y           mod

    5               x + y           add
    5               x - y           sub

    6               x < y           smaller        
    6               x > y           larger
    6               x <= y          smallereq
    6               x >= y          largereq
    6               x = y           equal
    6               x <> y          unequal

    7               x & y           and
    7               x \ y           or

    8               x ? y : z       condition

```














