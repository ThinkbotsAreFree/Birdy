"use strict";



var sys = {
    unit: {},
    category: {},
    delivery: {
        children: {},
        wildcards: {},
        leaves: []
    },
    jobQueue: [],
    capture: {},
    delay: 50,
    todo: [],
    newBorn: [],
    status: "Paused",
    screen: {}
};



sys.output = function (topic, message) {

    Toastify({
        text: `<span class="output-topic">${topic} &nbsp </span> `+message,
        duration: 3000, 
        destination: "https://github.com/ThinkbotsAreFree/Birdy",
        newWindow: true,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: "linear-gradient(to bottom, #666, #444)",
        stopOnFocus: true, // Prevents dismissing of toast on hover
        onClick: function(){} // Callback after click
    }).showToast();    
}



function Unit(AST, id) {

    this.AST = AST;
    this.id = id || sys.newId();
    this.inbox = [];
    this.signature = [this.id];
    this.inChannel = this.AST.initInput;
    this.outChannel = ['global'];
    this.localVar = {};
    this.skipCommands = false;
    this.skipConditions = false;
    this.subscriptions = [];

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
            capture: deliveryPlan[receiver],
            senderId: this.id
        });
    }
};



Unit.prototype.reply = function (receiver, msg) {

    sys.jobQueue.push({
        receiver: receiver,
        message: msg,
        signature: this.signature.slice(),
        capture: {},
        senderId: this.id
    });
};



Unit.prototype.getTargetVariable = function (v) {

    if (v[0] !== '$') return v;

    return this.localVar[this.getTargetVariable(v.slice(1))];
};



Unit.prototype.setVariables = function (vars) {

    for (let v in vars) {

        var target = this.getTargetVariable(v.slice(1));

        this.localVar[target] = vars[v];
    }
};



Unit.prototype.suicide = function () {

    for (let sub of this.subscriptions)
        sys.delPath(this.id, sub, sys.delivery);

    delete sys.unit[this.id];
};



sys.kill = function(id) {

    sys.unit[id].suicide();
}



Unit.prototype.performSubstitution = function (line) {

    if (!Array.isArray(line)) return line;

    var result = [];

    for (let item of line) {
        if (item[0] === '§') result.push(this.senderSignature);
        else if (item[0] === '°') result.push(sys.newId());
        else if (item[0] !== '$') result.push(item);
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



sys.populate = function (source, uiElement) {

    var parsed;
    sys.newBorn = [];

    try {
        parsed = totalParser.parse(commentParser.parse(source));
    } catch(e) {
    }

    if (parsed) {
        parsed.units.forEach(unitAST => sys.createUnit(unitAST, false, uiElement));
        parsed.categories.forEach(cat => sys.createCategory(cat));
    }
};



sys.createUnit = function (AST, id, uiElement) {

    var unit = new Unit(AST, id, uiElement);
    sys.unit[unit.id] = unit;

    sys.newBorn.push(unit.id);

    sys.newPath(unit.id, unit.AST.initInput, sys.delivery);
};



sys.createCategory = function (def) {

    sys.setLine(def.pattern, def.template, sys.category);
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



sys.isBalanced = function (chain) {

    for (let c in chain) {

        var level = 0;
        var line = chain[c].slice();

        for (let l of line) {
            if (l === '(') level += 1;
            if (l === ')') level -= 1;
        }
        if (level !== 0) return false;
    }
    return true;
}



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

                var sliced = channel.slice(sliceSize);
                if (sys.isBalanced(sliced))
                    sys.buildDeliveryPlan(
                        sliced,
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



sys.showMessage = function(unit) {

    var msgId = sys.newId();

    var unitUI = $('#'+unit.ui);

    unitUI.html(
        unitUI.html().replace(/<br>/g, '').trim() + `<span id="${msgId}" class="message">\n➜ &nbsp; ${unit.receivedMessage.join(' ')}</span>`
    );

    setTimeout(new Function(`
        document.getElementById("${msgId}").outerHTML = '';
    `), 1000);
}



sys.stop = function () {
    $("#status").html("Paused");
    sys.status = "Paused";
    sys.output('ui', "Stop Loop");
};



sys.step = function (keepRunning, forever, ui) {

    if (sys.stopLoop) { forever = false; keepRunning = false; sys.stopLoop = false; }

    if (ui) {
        $("#status").html("Running");
        sys.status = "Running";
        if (ui.innerHTML) sys.output('ui', ui.innerHTML);
    }

    if (forever || (keepRunning && sys.jobQueue.length > 0)) {

        if (!forever) setTimeout(function () { sys.step(true, false); }, sys.delay);
        else setTimeout(function () { sys.step(true, true); }, sys.delay);
    }

    var job, unit;

    job = sys.jobQueue.shift();
    if (!job) return;

    unit = sys.unit[job.receiver];
    if (!unit) return;

    unit.receivedMessage = job.message;
    unit.senderSignature = job.signature;
    unit.senderId = job.senderId;

    if (unit.ui) sys.showMessage(unit);

    unit.setVariables(job.capture);

    sys.todo = JSON.parse(JSON.stringify(unit.AST.commands));

    while (sys.todo.length > 0) {

        var doing = sys.todo.shift();

        if (unit.skipCommands) {

            if (doing.com === ';' || doing.com === ',') unit.skipCommands = false;

        } else {

            if (!(unit.skipConditions && sys.isCondition(doing.com))) {

                doing.arg = unit.performSubstitution(doing.arg);

                sys.execute[doing.com[0]](unit, doing);
            }
        }
    }

    if (!forever && (sys.jobQueue.length === 0 || !keepRunning)) {
        $("#status").html("Paused");
        sys.status = "Paused";
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

        sys.output("stdout", doing.arg.join(' '));
    },



    '>': function (unit, doing) { // publish

        unit.publish(doing.arg);
    },



    '<': function (unit, doing) { // reply

        unit.reply(unit.senderId, doing.arg);
    },



    '@': function (unit, doing) { // on channel

        unit.outChannel = doing.arg;
    },



    '{': function (unit, doing) { // subscribe

        unit.subscriptions.push(doing.arg);
        sys.newPath(unit.id, doing.arg, sys.delivery);
    },



    '}': function (unit, doing) { // subscribe

        var strArg = JSON.stringify(doing.arg);
        unit.subscriptions = unit.subscriptions.filter(sub => JSON.stringify(sub) !== strArg);
        sys.delPath(unit.id, doing.arg, sys.delivery);
    },



    '+': function (unit, doing) { // if message matches

        var outcome = sys.match(unit.receivedMessage, doing.arg);

        if (outcome) {

            unit.setVariables(outcome);

        } else {

            unit.skipCommands = true;
        }
    },



    '-': function (unit, doing) { // if message doesn't match

        var outcome = sys.match(unit.receivedMessage, doing.arg);

        if (outcome) {

            unit.setVariables(outcome);

            unit.skipCommands = true;
        }
    },



    '?': function (unit, doing) { // if variable matches

        var outcome = sys.match(
            unit.localVar[unit.getTargetVariable(doing.id)],
            doing.arg
        );

        if (outcome) {

            unit.setVariables(outcome);

        } else {

            unit.skipCommands = true;
        }
    },



    '!': function (unit, doing) { // if variable doen't match

        var outcome = sys.match(
            unit.localVar[unit.getTargetVariable(doing.id)],
            doing.arg
        );

        if (outcome) {

            unit.setVariables(outcome);

            unit.skipCommands = true;
        }
    },



    '=': function (unit, doing) { // set variable

        unit.setVariables({ ['#' + doing.id]: doing.arg });
    },



    ':': function (unit, doing) { // get match

        var msg = sys.queryLine(doing.arg, sys.category);

        var localVar = JSON.stringify(unit.localVar);
        unit.setVariables(sys.capture);
        msg = unit.performSubstitution(msg);
        unit.localVar = JSON.parse(localVar);

        unit.setVariables({ ['#' + doing.id]: msg });
    },



    '&': function (unit, doing) { // eval scheme

        var expr = '('+doing.arg.join(' ')+')';

        unit.setVariables({ ['#' + doing.id]: biwaScheme.evaluate(expr) });
    },



    '%': function (unit, doing) { // replace in variable

        var value = unit.localVar[unit.getTargetVariable(doing.id)];

        var pattern = doing.arg.old;
        var v = 0;
        var p = 0;
        var stock = [];
        var result = [];

        while (v < value.length) {

            stock.push(value[v]);
            if (value[v] === pattern[p]) {
                p++;
                if (stock.length === pattern.length) {
                    p = 0;
                    stock = [];
                    result = result.concat(doing.arg.new);
                }
            } else {
                p = 0;
                result = result.concat(stock);
                stock = [];
            }
            v++;
        }
        unit.setVariables({ ['#' + doing.id]: result });
    },



    '€': function (unit, doing) { // execute variable

        var program = unit.localVar[unit.getTargetVariable(doing.id)].concat(doing.arg);
        var parsed = totalParser.parse(commentParser.parse("| dummy " + program.join(' ')));

        sys.todo = parsed[0].commands.concat(sys.todo);
    },



    '*': function (unit, doing) { // create units

        sys.populate(doing.arg.join(' '));
    },



    '_': function (unit, doing) { // set signature

        unit.signature = doing.arg;
    },



    '~': function (unit, doing) { // die

        if (doing.arg.length > 0) unit.publish(doing.arg);
        unit.suicide();
    },



};



sys.setLine = function (rawline, fruit, tree) {

    var line = ['→'].concat(rawline).concat(['←']);

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



sys.removeLine = function (rawline, tree) {

    var line = ['→'].concat(rawline).concat(['←']);

    var cursor = tree;

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
    var level = 0;

    if (line.length > 1) {

        if (cursor[line[0]]) found = sys.query(line.slice(1), cursor[line[0]].branch);
        if (found) return found;

        if (cursor['?']) found = sys.query(line.slice(1), cursor['?'].branch);
        if (found) return found;

        if (cursor['*']) while (!found && line.length > 0) {
            if (!sys.capture[cursor['*'].item]) sys.capture[cursor['*'].item] = [];
            while (line.length > 0 && (line[0] === '(' || line[0] === ')' || level > 0)) {
                if (line[0] === '(') level += 1;
                if (line[0] === ')') level -= 1;
                sys.capture[cursor['*'].item].push(line[0]);
                line.shift();
            }
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



sys.queryLine = function (rawline, tree) {

    sys.capture = {};

    var line = ['→'].concat(rawline).concat(['←']);

    var result = sys.query(line.slice(0), tree);

    return result;
};



sys.match = function (message, pattern) {

    var tmpTree = {};

    sys.setLine(pattern, true, tmpTree);

    var result = sys.queryLine(message, tmpTree);

    return result ? sys.capture : false;
}


