"use strict";



const editor = document.getElementById("editor");
const output = document.getElementById("output");



const sys = {
    unit: {}
};



function Unit(AST) {

    this.AST = AST;
    this.id = sys.newId();
    this.outChannel = AST.outputChannel.join(' ');
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
        output.value += "\n[ID]→ "+sys.unit[u].id+" [OutChannel]→ "+sys.unit[u].outChannel+'\n';
        sys.unit[u].AST.commands.forEach(command => {
            output.value += "[Com]→ "+command.com;
            if (command.id) output.value += " [Var]→ "+command.id;
            if (Array.isArray(command.arg)) output.value += " [Arg]→ "+command.arg.join(", ");
            else if (command.arg) output.value += " [Old]→ "+command.arg.old.join(", ")+" [New]→ "+command.arg.new.join(", ");
            output.value += "\n";
        });
    }
}



sys.createUnit = function (AST) {

    var unit = new Unit(AST);
    sys.unit[unit.id] = unit;
}


