
![](http://noisett.lang.free.fr/BirdyVM.png)

# BirdyVM

BirdyVM is
* a message oriented virtual machine,
* a real-time **thinkbot/chatbot** engine,
* designed to be as small as possible, while still being powerful and easy.

A simple language, based on special characters instead of keywords, is used to describe a population of nodes called "units", which communicate asynchronously through a **publish/subscribe** system.

Here is a complete list of the 32 characters with special meaning.

```
    |       unit

    #1      capture value
    $1      insert value
    =1      set value
    &1      append to value
    %1 /    replace in value
    €1      execute value

    ?1      if value matches
    !1      if value doesn't match
    +       if message matches
    -       if message doesn't match
    ;       end if (stop skipping commands)
    ,       or (skip condition-commands)

    @       on channel
    >       publish
    <       reply
    ^       send to self

    {       subscribe
    }       unsubscribe

    *       create unit

    ~       die

    §       insert sender signature
    _       set my signature

    °       insert fresh ID

    ¤1      insert global value
    :1      set global value

    []      escape block
    ()      structured data

    ""      comment
```

## Overview

### Pub/sub

A BirdyVM program is made of a lot of very small [teleo-reactive](http://teleoreactiveprograms.net/?page_id=8) agents. Let's call these agents "units".

During the execution of the VM, units continuously receive and send messages to one another, asynchronously, and anonymously.

The Wikipedia [article](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) about the pub/sub pattern gives the following definition.
> In software architecture, publish/subscribe is a messaging pattern where senders of messages, called publishers, do not program the messages to be sent directly to specific receivers, called subscribers, but instead categorize published messages into classes without knowledge of which subscribers, if any, there may be. Similarly, subscribers express interest in one or more classes and only receive messages that are of interest, without knowledge of which publishers, if any, there are.

This pattern is usually employed as glue between software components. But in BirdyVM, pub/sub is the core architecture, where units are activated only when they receive a message.

## Structure of a unit definition

### Command format

A unit definition is mainly a succession of **commands**. Commands are the smallest building blocks of BirdyVM programs.

A command starts with a special character (the instruction), followed by a string of non-special characters (the argument). For example in the following code line:

```
+ hey @ global > hello world
```
We have 3 commands:

- `+ hey` -> if the received message matches the pattern "hey"

- `@ global` -> choose "global" as emission channel

- `> hello world` -> publish a "hello world" message

### Unit definition format

A unit definition starts with a vertical bar `|` immediately followed by a channel pattern, followed by commands. The following line is a valid and complete definition of a unit.
```
| from user + hi there @ to user > hello world
```

At startup, this unit is initially configured to receive all messages published on the `from user` channel.

### Escape blocks

Square brackets can be used to delimit blocks of uninterpreted characters. These blocks are a way to embed special characters in arguments:
```
+ I love you > sweet [<3]
```
Here, the `<` character isn't interpreted as a *reply* command, but simply as part of the message to be published.

The enclosing square brackets are removed from the argument. In the previous example, the published message is not `sweet [<3]` but simply `sweet <3`.

Square brackets are nestable, in which case they have to be balanced.
```
> You can [nest [balanced] square brackets] too
```
This would publish `You can nest [balanced] square brackets too`, where only the outer square brackets are removed.

### Signature of a unit

The signature of a unit is like a name, except it's not necessarily unique. It's a meta information that is always transfered with a message.

You set a unit's signature with the `_` command.
```
_ Zorro > Hey Tornado
```
The units that receive this message can insert the message sender signature with the `§` function.
```
+ Hey Tornado > looks like § lost his brave horse
```
This unit would send `looks like Zorro lost his brave horse`.

### Non-special characters

Non-special characters are: uppercase and lowercase letters, digits, white-space characters, and the period.

### Comments

Comments can be placed anywhere between double quotes `"..."`. They can contain any chararacter, except double quotes.

Comments are ignored by the VM.

## Execution of a unit's program

### Command categories

There are **action-commands** and **condition-commands**.

A condition-command performs a logical test. `+ - ? !` are condition-commands.
 
An action-command performs an action. `_ : = & % € @ > < ^ { } * ~` are action-commands.

A function returns a value. `§ ° ¤ $` are functions.

### Wildcards

In arguments:
* the *capture value* character `#` can be used to capture strings in **condition-commands**,
* the *insert value* character `$` can be used to insert previously stored strings in **any command**.
```
+ user wants #1 > is $1 available
```
If a unit with this code receives a message "user wants another topic", it will publish a message "is another topic available".

The character immediately following `#` and `$` is the **variable identifier**. It can be any non-special character, like a digit or a letter. Yes, it is only 1 character.

### Parentheses in glob patterns

Pattern matching in BirdyVM works almost like file glob patterns, with `#1` instead of `*`. But there's a key difference.

Pattern matching in BirdyVM is **parentheses-sensitive**. If an opening parenthesis is captured, the corresponding closing parenthesis must also be captured. If an opening parenthesis is not captured, the corresponding closing parenthesis cannot be captured.

In other words, if a capture has parentheses, they are necessarily balanced.

This important feature makes structured messaging possible and easy: since units can manipulate and send s-expression based messages, any kind of data structure can be expressed.

### Control flow

When a unit receives a message, the message goes through all of the unit's commands, one by one, in order.

When the message flows through an action-command, the action is executed.

When it flows through a condition-command, a test is performed. If the test fails, the flow jumps **after** the next comma `,` or **after** the next semicolon `;`.

* Semicolon `;` is a command that stops skipping commands
* Comma `,` is a command that starts skipping condition-commands

Semicolon `;` indicates the end of an *IF-THEN* structure. Comma `,` can be used to introduce *OR* connectives in conditional expressions.

Comma is OR. Semicolon is ENDIF. In this example:

```
+C1 +C2 , +C3 +C4 > True ; 
```
`True` is sent if `C1` and `C2` are true, or if `C3` and `C4` are true.


### Variables

A string captured with `#x` is in fact stored in the variable `x`. Variables are local to a unit. There are several ways to manipulate values stored in variables.

Naturally, you can set the value of a variable.
```
=x my new value
```
This would assign the string `my new value` to the variable `x`.

You can append (concatenate) a new value to a variable.
```
&x is longer
```
Now `x` contains the value `my new value is the longest value`.

You can also replace all occurences of a substring, using a slash character `/` between the old substring and the new substring.
```
%x value / name
```
Now `x` contains the value `my new name is the longest name`.

There's also a powerful command that lets you **execute a value** contained in a local variable, as if it was a fragment of code. For example, say a variable `y` contains `@ user > my dog likes`, then:
```
€y my cat
```
This would choose `user` as emission channel and send the message `my dog likes my cat`. Executing values can contain executing values.

Variables can be tested by conditionals just like the received message.
```
?x my value is #w > it is $w
```
This will send `it is longer` only if the variable `x` contains `my value is longer`.

#### Global variables

For convenience (or rather for potential use cases I can't think of right now), units can read (insert) global variables with the function `¤1`, and write (assign) global variables with the command `:1`.

In case of collision, if two units assign a value to the same global variable simultaneously, nothing happens: the value of the global variable remains unchanged.

#### Indirect variable access

Syntactically, variable names can only be 1 character long. But there's a way to overcome this limitation.

It is possible to access a variable indirectly, when its name is stored in another variable. For example, if the variable `i` contains the value `my variable`, then:
```
=$i my value
```
This would assign the value `my value` to the variable named `my variable`. To read a variable's value indirectly, it's just the same:
```
> here is $$i
```
This would send `here is my value`.

### State persistence

The whole state of a unit remains unchanged between the receptions of 2 messages. The emission channel and variables' content won't be deleted after a message has been treated.
```
| global
+ save #1 > done
+ give it > I saved $1
```
After this unit receives a `save foo` message, the variable `#1` will contain `foo`. Then, if it receives a `give it` message, it will publish `I saved foo`.

## The network

### Channels

Messages are published on channels. Channels are simply **strings**.

Units receive only messages that were published on channels they subscribed to.

To subscribe to a new channel, a unit must execute the *subscribe* command `{`. To unsubscribe, the *unsubscribe* command `}` must be executed. Obviously, curly braces don't have to be balanced, because these two commands are independent.
```
| global + please listen to #1 { dynamic.$1
```
At startup, this unit is configured to listen to the `global` channel.

If it receives a `please listen to subch1` message, it will subscribe to the `dynamic.subch1` channel, and will start receiving messages published on this channel too.

### Channel patterns

It is possible to configure a unit to listen to every channel that matches a pattern.

For example, `{ ch.#A` means "subscribe to every channel that matches `ch.#A`". With this subscription, when a message is received on channel `ch.bar`, the variable `A` will contain `bar`.

To unsubscribe from a channel pattern, the exact same pattern must be given as argument, like this: `} ch.#A`

### Units creation

The *create unit* command `*` takes its argument and makes a new unit out of it.
```
| global
+ make greeter #1
* [| from user + ]$1[ > hello]
```
When this unit receives a `make greeter hey` message, it will create the following unit:
```
| from user + hey > hello
```
Notice how I didn't escape the `$1` value insertion in the *create unit* command.

### Units death

The *die* command `~` allows a unit to delete itself.

The argument of the *die* command is the "testament" of the unit: it is a message that will be emitted just before the unit is deleted.

## Commands and functions detailed

### #1 capture value

The *capture value* function capture a string and assigns it to a variable.

### $1 insert value

The *insert value* funtcion inserts the value of a variable.

### =1 set value

The *set value* command assigns a value to a variable.

### &1 append to value

The *append to value* command concatenates a string to the value in a variable.

### %1 / replace in value

The *replace in value* performs substring substitution in a variable.

### €1 execute value

The *execute value* evaluates a value as if it was a fragment of code.

### ?1 if value matches

The *if value matches* command is a condition-command that succeeds only if the variable's value matches a pattern.

If it succeeds, the wildcards used in the pattern will contain the captured strings.

### !1 if value does not match

The *if value does not match* command is a condition-command that succeeds only if the variable's value doesn't match a pattern.

If it fails, the wildcards used in the pattern will contain the captured strings.

### + if message match

The *if message match* command is a condition-command that succeeds only if the received message matches a pattern.

If it succeeds, the wildcards used in the pattern will contain the captured strings.

### - if message doesn't match

The *if message doesn't match* command is a condition-command that succeeds only if the received message doesn't match a pattern.

If it fails, the wildcards used in the pattern will contain captured strings.

### ; stop skipping

The *stop skipping* command marks then end of a conditional expression.

### , skip conditions

The *skip conditions* command skips condition-commands, acting as a logical OR.

### @ on channel

The *on channel* command modifies the current **emission channel** of the unit.

By default, a unit publishes its messages on the `global` channel.

A message can only be published on 1 channel.

### > publish

The *publish* command publishes a message on the current emission channel.

All units that subscribed to this channel will receive the message.

### < reply

The *reply* command sends a message only to the unit that published the received message.

### ^ send to self

The *send to self* command sends a message only to the sending unit.

### { subscribe

The *subscribe* command makes the unit listen to a channel, or to every channel matching a pattern.

### } unsubscribe

The *unsubscribe* command makes the unit stop listening to a channel, or to every channel matching a pattern.

### * create unit

The *create unit* command creates a new unit. The argument will be the new unit's  source code.

### ~ die

The *die* command deletes the unit which executes it. The argument will be the last message published by the unit before it disappears.

### § insert sender signature

The *insert sender signature* function returns the signature of the unit who sent the current message.

### _ set my signature

The *set my signature* command is used to choose a string as the signature of the unit.

### ° insert fresh ID

The *insert fresh ID* function inserts an auto-increment ID number, made of digits only. Its purpose is to create new vocabulary.

### ¤1 insert global value

The *insert global value* function insert the current value of a global variable.

### :1 set global value

The *set global value* command tries to assign a value to a global variable. It can fail if several units try to do it simultaneously, in which case nothing happens.














