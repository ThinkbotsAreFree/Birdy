"use strict";



const editor = document.getElementById("editor");
const output = document.getElementById("output");



const sys = {
    unit: {},
    delivery: {
        children: {},
        wildcards: {},
        leaves: []
    }
};



function Unit(AST) {

    this.AST = AST;
    this.id = sys.newId();
    this.inbox = [];
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
}



sys.createUnit = function (AST) {

    var unit = new Unit(AST);
    sys.unit[unit.id] = unit;

    sys.newPath(unit.id, unit.AST.initInput, sys.delivery);
}



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
}



sys.getDeliveryPlan = function (channel) {

    sys.delivering = {};

    sys.buildDeliveryPlan(channel, sys.delivery, '{');

    return sys.delivering;
}


sys.buildDeliveryPlan = function (channel, node, capture) {

    if (channel.length > 0) {

        var channelSlice = channel.slice(1);

        if (node.children[channel[0]]) {

            sys.buildDeliveryPlan(
                channelSlice,
                node.children[channel[0]],
                capture
            );
        }

        for (let wildcard in node.wildcards) {

            sys.buildDeliveryPlan(
                channelSlice,
                node.wildcards[wildcard],
                capture + `"${wildcard}":"${channel[0]}",`
            );
        }

    } else {

        if (capture[capture.length-1] === ',') capture = capture.slice(0, -1);
        var result = JSON.parse(capture+'}');

        node.leaves.forEach(leaf => {
            sys.delivering[leaf] = result;
        });
    }
}



function doTest() {

    console.log(sys.delivery);
    console.log(sys.getDeliveryPlan(['a', 'b', 'c']));
}