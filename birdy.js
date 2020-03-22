


var sys = {};



sys.parseEditor = function() {

    sys.source = document.getElementById("editor").value;

    sys.parsed = parser.parse(sys.source);

    document.getElementById("output").value = JSON.stringify(sys.parsed, null, 4);
}


