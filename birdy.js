"use strict";



const editor = document.getElementById("editor");
const output = document.getElementById("output");



const sys = {
    unit: {},
    delivery: {
        children: {},
        wildcards: {},
        leaves: []
    },
    jobQueue: [],
    speechTree: {},
    capture: {},
    delay: 500
};



function Unit(AST) {

    this.AST = AST;
    this.id = sys.newId();
    this.inbox = [];
    this.signature = [this.id];
    this.inChannel = ['global'];
    this.outChannel = ['global'];
    this.localVar = {};
    this.skipCommands = false;
    this.skipConditions = false;

    this.receivedMessage = [];
    this.senderSignature = [];
}



Unit.prototype.publish = function (msg) {

    var deliveryPlan = sys.getDeliveryPlan(this.outChannel);

    for (let receiver in deliveryPlan) {

        sys.jobQueue.push({
            receiver: receiver,
            message: msg,
            signature: this.signature.slice(),
            capture: deliveryPlan[receiver]
        });
    }
};



Unit.prototype.getTargetVariable = function(v) {

    if (v[0] !== '$') return v;

    return this.localVar[this.getTargetVariable(v.slice(1))];
};



Unit.prototype.setVariables = function(vars) {

    for (let v in vars) {

        var target = this.getTargetVariable(v.slice(1));

        this.localVar[target] = vars[v];
    }
};



Unit.prototype.performSubstitution = function(line) {

    if (!line) return line;

    var result = [];

    for (let item of line) {
        if (item[0] !== '$') result.push(item);
        else result = result.concat(this.getTargetVariable(item))
    }

    return result;
}



sys.newId = (function () {
    sys.currentId = '0';
    var addOne = function (s) {
        let newNumber = '';
        let continueAdding = true;
        for (let i = s.length - 1; i >= 0; i--) {
            if (continueAdding) {
                let num = parseInt(s[i], 10) + 1;
                if (num < 10) {
                    newNumber += num;
                    continueAdding = false;
                } else {
                    newNumber += '0';
                    if (i == 0) newNumber += '1';
                }
            } else {
                newNumber += s[i];
            }
        }
        return newNumber.split('').reverse().join('');
    }
    return function (prefix) {
        prefix = prefix || '';
        sys.currentId = addOne(sys.currentId);
        return prefix + sys.currentId;
    };
})();



sys.parseEditor = function () {

    sys.source = editor.value;

    sys.parsed = parser.parse(sys.source);

    sys.parsed.forEach(unitAST => sys.createUnit(unitAST));

    output.value = '';
    if (0) for (let u in sys.unit) {
        output.value += "\n[ID]→ " + sys.unit[u].id + " [InChannel]→ " + sys.unit[u].AST.initInput.join(", ") + '\n';
        sys.unit[u].AST.commands.forEach(command => {
            output.value += "[Com]→ " + command.com;
            if (command.id) output.value += " [Var]→ " + command.id;
            if (Array.isArray(command.arg)) output.value += " [Arg]→ " + command.arg.join(", ");
            else if (command.arg) output.value += " [Old]→ " + command.arg.old.join(", ") + " [New]→ " + command.arg.new.join(", ");
            output.value += "\n";
        });
    }

    doTest();
};



sys.createUnit = function (AST) {

    var unit = new Unit(AST);
    sys.unit[unit.id] = unit;

    sys.newPath(unit.id, unit.AST.initInput, sys.delivery);
};



sys.newPath = function (id, path, node) {

    if (path.length > 0) {

        var sub = (path[0][0] === '#') ? "wildcards" : "children";

        if (!node[sub][path[0]]) node[sub][path[0]] = {
            children: {},
            wildcards: {},
            leaves: []
        };
        sys.newPath(id, path.slice(1), node[sub][path[0]]);

    } else {

        node.leaves.push(id);
    }
};



sys.delPath = function (id, path, node) {

    if (path.length > 0) {

        var sub = (path[0][0] === '#') ? "wildcards" : "children";

        if (sys.delPath(id, path.slice(1), node[sub][path[0]]))

            delete node[sub][path[0]];

    } else {

        node.leaves = node.leaves.filter(leaf => leaf !== id);
    }

    return ((Object.keys(node.children).length === 0)
        && (Object.keys(node.wildcards).length === 0));
};



sys.getDeliveryPlan = function (channel) {

    sys.delivering = {};
    sys.deliveryFound = 0;

    sys.buildDeliveryPlan(channel, sys.delivery, '{');

    return sys.delivering;
};



sys.buildDeliveryPlan = function (channel, node, capture) {

    if (channel.length > 0) {

        if (node.children[channel[0]]) {

            sys.buildDeliveryPlan(
                channel.slice(1),
                node.children[channel[0]],
                capture
            );
        }

        for (let wildcard in node.wildcards) {

            let found = 0 + sys.deliveryFound;
            let sliceSize = 1;

            while (found === sys.deliveryFound && sliceSize <= channel.length) {

                sys.buildDeliveryPlan(
                    channel.slice(sliceSize),
                    node.wildcards[wildcard],
                    capture + `"${wildcard}":[${channel.slice(0, sliceSize).map(c => '"' + c + '"').join(',')}],`
                );
                sliceSize += 1;
            }
        }

    } else {

        if (capture[capture.length - 1] === ',') capture = capture.slice(0, -1);
        var result = JSON.parse(capture + '}');

        node.leaves.forEach(leaf => {
            sys.delivering[leaf] = result;
            sys.deliveryFound += 1;
        });
    }
};



sys.step = function (keepRunning) {

    var job = sys.jobQueue.shift();
    var unit = sys.unit[job.receiver];

    unit.receivedMessage = job.message;
    unit.senderSignature = job.signature;

    var todo = unit.AST.commands.slice();

    while (todo.length > 0) {

        var doing = todo.shift();

        if (unit.skipCommands) {

            if (doing.com === ';' || doing.com === ',') unit.skipCommands = false;

        } else {

            if (!(unit.skipConditions && sys.isCondition(doing.com))) {

                doing.arg = unit.performSubstitution(doing.arg);

                sys.execute[doing.com[0]](unit, doing);
            }
        }
    }

    if (keepRunning && sys.jobQueue.length > 0) {

        setTimeout(function () { sys.step(true); }, sys.delay);
    }
}



sys.isCondition = function (com) { return ['+', '-', '?', '!'].includes(com[0]); }



sys.execute = {



    ';': function (unit, doing) { // stop skipping commands

        unit.skipCommands = false;
        unit.skipConditions = false;
    },



    ',': function (unit, doing) { // start skipping conditions

        unit.skipConditions = true;
    },



    '^': function (unit, doing) { // output

        console.log("[output]", doing.arg);
        output.value += doing.arg.join(' ') + '\n';
    },



    '>': function (unit, doing) { // publish

        unit.publish(doing.arg);
    },



    '@': function (unit, doing) { // on channel

        unit.outChannel = doing.arg;
    },



    '+': function (unit, doing) { // if message matches

        var outcome = sys.match(unit.receivedMessage, doing.arg);

        if (outcome) {

            console.log("[outcome]", outcome);
            unit.setVariables(outcome);
            
        } else {

            unit.skipCommands = true;
        }
    },



    '-': function (unit, doing) { // if message doesn't match

        var outcome = sys.match(unit.receivedMessage, doing.arg);

        if (outcome) {

            console.log("[outcome]", outcome);
            unit.setVariables(outcome);
            
            unit.skipCommands = true;
        }
    },



    '?': function (unit, doing) { // if variable matches

        console.log("[doing]", doing);
        var outcome = sys.match(
            unit.localVar[unit.getTargetVariable(doing.id)],
            doing.arg
        );

        if (outcome) {

            console.log("[outcome]", outcome);
            unit.setVariables(outcome);
            
        } else {

            unit.skipCommands = true;
        }
    },



    '!': function (unit, doing) { // if variable doen't match

        console.log("[doing]", doing);
        var outcome = sys.match(
            unit.localVar[unit.getTargetVariable(doing.id)],
            doing.arg
        );

        if (outcome) {

            console.log("[outcome]", outcome);
            unit.setVariables(outcome);
            
        } else {

            unit.skipCommands = true;
        }
    },



};



sys.setLine = function (line, fruit, tree) {

    var cursor = tree,
        parent;

    var itemId = 1;

    line.forEach(item => {

        var token = (item[0] === '#') ? '*' : item;
        if (!cursor[token]) cursor[token] = {
            branch: {},
            count: 0,
            item: (item === '*' || item === '?') ? '#' + (itemId++) : item
        };
        parent = cursor[token];
        cursor[token].count += 1;
        cursor = cursor[token].branch;
    });
    parent.fruit = fruit;
};



sys.removeLine = function (rawLine, tree) {

    var cursor = tree,
        line = rawLine.slice(0);

    while (line.length) {

        if (cursor[line[0]].count == 1) {
            delete cursor[line[0]];
            line = [];
        } else {
            cursor[line[0]].count -= 1;
            cursor = cursor[line[0]].branch;
            line.shift();
        }
    }
};



sys.query = function (line, cursor) {

    var found;

    if (line.length > 1) {

        if (cursor[line[0]]) found = sys.query(line.slice(1), cursor[line[0]].branch);
        if (found) return found;

        if (cursor['?']) found = sys.query(line.slice(1), cursor['?'].branch);
        if (found) return found;

        if (cursor['*']) while (!found && line.length > 0) {
            if (!sys.capture[cursor['*'].item]) sys.capture[cursor['*'].item] = [];
            sys.capture[cursor['*'].item].push(line[0]);
            line.shift();
            found = sys.query(line, cursor['*'].branch);
        }
        if (found) return found;
        if (cursor['*']) return cursor['*'].fruit;

        return undefined;
    }
    if (cursor[line[0]]) return cursor[line[0]].fruit;
    if (cursor['?']) return cursor['?'].fruit;
    if (cursor['*']) return cursor['*'].fruit;
}



sys.queryLine = function (line, tree) {

    var result = sys.query(line.slice(0), tree);

    return result;
};



sys.match = function (message, pattern) {

    var tmpTree = {};

    sys.setLine(pattern, true, tmpTree);

    var result = sys.queryLine(message, tmpTree);

    return result ? sys.capture : false;
}



function doTest() {

    sys.unit[1].publish("this is a brand new world".split(' '));

    //console.log(sys.getDeliveryPlan(['a', 'b', 'c']));

    /*
        sys.unit[3].outChannel = ['a', 'i', 'j', 'b', 'c'];
        sys.unit[3].publish(['this', 'is', 'it']);
        console.log(sys.jobQueue);
    */
    /*
     console.log(sys.match(
         ['a', 'b', 'c', 'd', 'e', 'a', 'b', 'c', 'd', 'e'],
         ['a', '#x', 'd', '#y']
     ));
     */
}


