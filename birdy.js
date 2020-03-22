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
    globalVar: {}
};



function Unit(AST) {

    this.AST = AST;
    this.id = sys.newId();
    this.inbox = [];
    this.signature = [this.id];
    this.inChannel = ['global'];
    this.outChannel = ['global'];

    this.receivedMessage = [];
    this.senderSignature = [];
}



Unit.prototype.publish = function(msg) {

    var deliveryPlan = sys.getDeliveryPlan(this.outChannel);

    for (let receiver in deliveryPlan) {

        sys.jobQueue.push({
            receiver:  receiver,
            message:   msg,
            signature: this.signature.slice(),
            capture:   deliveryPlan[receiver]
        });
    }
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
    for (let u in sys.unit) {
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

            let found = 0+sys.deliveryFound;
            let sliceSize = 1;

            while (found === sys.deliveryFound && sliceSize <= channel.length) {

                sys.buildDeliveryPlan(
                    channel.slice(sliceSize),
                    node.wildcards[wildcard],
                    capture + `"${wildcard}":[${channel.slice(0, sliceSize).map(c => '"'+c+'"').join(',')}],`
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



sys.step = function(keepRunning) {

    var job = sys.jobQueue.shift();
    var unit = sys.unit[job.receiver];

    unit.receivedMessage = job.message;
    unit.senderSignature = job.signature;

    var todo = unit.AST.commands.slice();

    while (todo.length > 0) {

        var doing = todo.shift();
        sys.execute[doing.com[0]](unit, doing);
    }

    output.value = JSON.stringify(sys, null, 4);
}



sys.execute = {



    '>': function(unit, doing) { // publish

        unit.publish(doing.arg);
    },



    '@': function(unit, doing) { // on channel

        unit.outChannel = doing.arg;
    },



    '+': function(unit, doing) { // if message matches

    },



};



sys.match = function(message, pattern) {

    return {
        success: true,
        capture: {}
    };
};



function doTest() {

    //console.log(sys.getDeliveryPlan(['a', 'b', 'c']));

    sys.unit[3].outChannel = ['a', 'i', 'j', 'b', 'c'];
    sys.unit[3].publish(['this', 'is', 'it']);
    console.log(sys.jobQueue);


}


