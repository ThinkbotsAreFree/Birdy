
![BirdyVM](https://raw.githubusercontent.com/ThinkbotsAreFree/Birdy/master/images/birdy.png)

# BirdyVM

BirdyVM is
* a message oriented virtual machine,
* a real-time **thinkbot/chatbot** engine,
* designed to be as small as possible, while still being powerful and easy.

A concise language, based on special characters instead of keywords, is used to describe a population of nodes called **units**, which communicate asynchronously through a **publish/subscribe** system.

A working prototype is online here: [ProjectBirdyVM/](http://thinkbots.are.free.fr/ProjectBirdyVM/)

Here is a complete list of the 32 characters with special meaning.

```
    |       unit
    ¤       rule

    ^       send to output

    #1      capture value
    $1      insert value
    =1      set value
    :1      call SRS
    &1      eval Scheme
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

    {       subscribe
    }       unsubscribe

    *       create unit

    ~       die

    §       insert sender signature
    _       set my signature

    °       insert fresh ID

    []      escape block
    ()      structured data

    ""      comment
```

## The big picture

#### A chatbot composed of a swarm of smaller agents sounds interesting and novel. What motivated this architectural idea, and what do you see as its advantages?

I strongly believe that learning is overrated in the Ai field. Yes, children do learn. But look at adults: they don't change their thought schemas everytime they store something in their memory. I don't see learning as the main mechanism of intelligence.

Pattern matching is central. More precisely, given a situation, the whole system should adapt and react, each module doing its share. In AIML-style chatbots, one line is dispatched through a "graphmaster" tree, to reach one single reaction, typically the reply to the user. The big idea of BirdyVM is to broadcast a line through the tree to *every* interested endpoints. At each node, instead of choosing one best child, all eligible children receive of copy of the message.

Another difference with classical chatbot engines is that BirdyVM is not a one-shot REPL, but an event loop. The system is meant to run continuously, reacting to external/internal events as they occur. To me, it's more like what's in a human mind, which is never empty between two interactions. It can therefore be plugged in a robot's body quite naturally.

A major advantage of this architecture is the opportunity to describe directly the structures of communicating modules where thoughts flow. It follows the Keep It Simple way of doing things. Ai should be a people's thing, not a corporation's thing. In BirdyVM, you create the mind of the bot at the highest level: the level you'd use to describe it orally to somebody. The way you'd describe it to someone else, is the very way you design your rules and units, with words and sentences.

Consciousness is more than the inner discourse most of us humans experience everyday, but inner discourse is still the most obvious manifestation of our thinking processes. BirdyVM lets you create interacting inner discourse generators.

#### What design strategy might be followed by someone creating a chatbot using this architecture?

Right now, only a Javascript prototype has been implemented. It is not a good tool for authoring production ready thinkbots, but it's enough to test snippets and get used to the "spirit" of the platform.

On a serious implementation, say in Rust or Go, pluggable in usual channels (social, websites, apps, ...etc.), additional tools would be needed to author bots. Assuming these tools exist, a simple design strategy would be to start bottom-up.

Beginning with a few brainstorming sessions, the first step would be to produce a quantity of examples of situations and associated thought-trains that you want the bot to show.

From these examples, generalized schemas could be extracted, and once extracted they could be enriched with additional functionalities and edge cases.

Then top-down begins, with the design of a handful of big "lobes", each of which has a precise but wide field of responsabilities. Then in each lobe, sub-lobes, or "lobules" can be designed with smaller fields and more proactive effects on the system.

These recursive steps borrow from the Agile world, which is particularly welcome here. Start small to get a minimal but functional product quickly, and start from there. Test every now and then, test, test, and test again, receive feedback from the users and keep adding functionalities as you go. It's probably a never-ending job, because a mind is a big thing.

Be careful if you use automatic content generator.

#### What considerations would enter into the allocation of functionality to different agents, or the selection of pre-built agents from a library?

Agents are really *really* small, compared to what you're probably used to, typically down to a pattern match and one or two actions. So I don't think the designer should think in terms of functionalities allocated to an agent, but rather allocated to a *community* of agents.

A good design involves two kinds of agents communities. There are general purpose "conceptual" communities, and real world "instantial" communities.
- An example of conceptual agent community would be a natural language generation module. Given a structured info to communicate, its job is to build a natural language sentence out of it, following appropriate grammar rules and linguistic style.
- An example of instantial community would be a community of agents storing and handling everything about a particular employee of your company. Don't see it as a database though: it is rather a set of reflexes associated and adapted to a specific instance.

Communities of agents, both conceptual and instantial, are of course good candidates for sharing and reusing code, by storing them in libraries. At this point however, the possibity to export and import libraries has not been fully explored / implemented. 

#### What kinds of messages might agents want to pass to each other?

Simple messages. Messages are structured, thanks to parentheses-sensitivity pattern matching (that handles nesting correctly), but I believe they should remain simple.

One message should convey only 1 information. If you have several things to say, send several messages.

One message should give information about what happened, not about what should happen next.

Messages should be as natural as possible. Ideally, a developper reading a message should be able to understand all of it without having to search the whole brain for missing / unclear references.

## Overview

Let's get to work!

### Pub/sub

A BirdyVM program is made of a lot of very small teleo-reactive agents, called "units".

During the execution of the VM, units continuously receive and send messages to one another, asynchronously, and anonymously.

The Wikipedia [article](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) about the pub/sub pattern gives the following definition.
> In software architecture, publish/subscribe is a messaging pattern where senders of messages, called publishers, do not program the messages to be sent directly to specific receivers, called subscribers, but instead categorize published messages into classes without knowledge of which subscribers, if any, there may be. Similarly, subscribers express interest in one or more classes and only receive messages that are of interest, without knowledge of which publishers, if any, there are.

While the Pub/Sub pattern is often employed as glue between software components, it is one of the core mechanisms of BirdyVM, the other one being a String Rewriting System.

## Structure of a unit definition

### Command format

A unit definition is mainly a succession of **commands**. Commands are the smallest building blocks of BirdyVM programs.

A command starts with a special character (the instruction), followed by a string of non-special characters (the argument). For example in the following code line:

```
+ hey @ global > hello world
```
You have 3 commands:

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

A function returns a value. `§ ° $` are functions.

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

* Semicolon `;` stops skipping commands
* Comma `,` starts skipping condition-commands

Semicolon `;` indicates the end of an *IF-THEN* structure. Comma `,` can be used to introduce *OR* connectives in conditional expressions.

Comma is OR. Semicolon is ENDIF. In this example:

```
+ C1 + C2 , + C3 + C4 > True ; 
```
`True` is sent if `+ C1` and `+ C2` are true, or if `+ C3` and `+ C4` are true.


### Variables

A string captured with `#x` is in fact stored in the variable `x`. Variables are local to a unit. There are several ways to manipulate values stored in variables.

Naturally, you can set the value of a variable.
```
=x my new value
```
This would assign the string `my new value` to the variable `x`.

You can append (concatenate) a new value to a variable.
```
=x $x is the longest value
```
Now `x` contains the value `my new value is the longest value`.

You can also replace all occurences of a substring, using a slash character `/` between the old substring and the new substring.
```
%x value / name
```
Now `x` contains the value `my new name is the longest name`.

Variables can be **tested by conditionals** just like the received message.
```
?x my value is #w > it is $w
```
This will send `it is longer` only if the variable `x` contains `my value is longer`.

#### Value execution

There's also a powerful command that lets you **execute a value** contained in a local variable, as if it was a fragment of code. For example, say a variable `y` contains `@ user > my dog likes`, then:
```
€y my cat
```
This would choose `user` as emission channel and send the message `my dog likes my cat`.

Executing values can contain executing values, which means that it is *possible* to express **recursive algorithms**.

While powerful, this feature opens the door to potential infinite loops. To prevent them, a maximum number of execution steps is defined in the configuration file (default 1000). If a unit reaches the maximum number of steps, it is inhibited and marked as having unwanted behavior.

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

#### Scheme interpretation

A Scheme expression can be evaluated and its return value stored in a variable with the `&1` **eval Scheme** command.
```
&r [+ 1 2] ^ result $r
```
This would output `result 3`. In the current implementation, the interpreter is [BiwaScheme-0.6.9](https://www.biwascheme.org/index.html).

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

Actually, when you design your programs, channel patterns should be the preferred method for analysing a situation. Instead of choosing a simple channel and a complex message, always make complex channels and simple messages, because this is how you'll make the *entire* system adapt to a situation. Relevant data should be in the `@` channel, rather than in the `>` message.

### Units and rules generation

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

### Program output

The return command `^` can be used to send values to the program standard output. Typically, this is how a BirdyVM program "speaks" to the user.

```
+ hey ^ [Hi there!]
```

This would output `Hi there!`

## The String Rewriting System

BirdyVM has a global SRS made of **rules**. These rules are defined with a currency sign `¤` followed by a pattern, a slash character `/`, and a response template.

Here is an example of a complete definition of a rule.

```
¤ I feel very #A / Why am I so $A
```

A call is made with the "call SRS" command `:1`, which is used a bit like the "set value" command `=1`, except what gets stored is not the argument, but the response of a rule to this argument. Here is an example of an SRS call.

```
:e I feel very happy
```
The example above would store the value `Why am I so happy` in the local variable `e`.

Rules are inspired from [Thue](https://esolangs.org/wiki/Thue), and even though this description is short (because BirdyVM's rules are a simple mechanism), their importance shouldn't be underestimated.

Indeed, units and rules are like two sides of the coin.

- **Units** are *concave* lenses that tend to produce **divergent thinking** (explorative, spontaneous, free-flow).
- **Rules** are *convex* lenses that tend to produce **convergent thinking** (focusing, logical, procedural).

A well shaped program should make an appropriately balanced use of both units and rules, for they have complementary strengths and use cases.

## Commands and functions detailed

### #1 capture value

The *capture value* function capture a string and assigns it to a variable.

### $1 insert value

The *insert value* funtcion inserts the value of a variable.

### =1 set value

The *set value* command assigns a value to a variable.

### :1 call SRS

The *call SRS* command executes a matching rule, and assigns to a variable the return value of the responding rule.

### &1 eval Scheme

The *eval Scheme* command assigns to a variable the result of evaluating a Scheme expression given as argument. In the current implementation, the interpreter is [BiwaScheme-0.6.9](https://www.biwascheme.org/index.html).

### %1 / replace in value

The *replace in value* command performs substring substitution in a variable.

### €1 execute value

The *execute value* command evaluates a value as if it was a fragment of code.

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

### ^ output

The *output* command sends a message to the program's standard output.

### { subscribe

The *subscribe* command makes the unit listen to a channel, or to a channel pattern.

### } unsubscribe

The *unsubscribe* command makes the unit stop listening to a channel, or to a channel pattern.

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









