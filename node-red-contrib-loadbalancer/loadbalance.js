function random(m) {
}
 
module.exports = function(RED) {
    function loadBalanceNode(n) {
        RED.nodes.createNode(this,n);
        var node=Object.assign(this,{path:1},n);
        switch (node.selection) {
        	case 'random':
        		var base=node.outputs+1;
        		var setPath = function() {
        			node.path=Math.floor(Math.random()*base);
        		};
        		break;
        	case 'next':
        		var setPath = function() {
            		if(!(--node.path)) {
            			node.path=node.outputs;
            		}
        		};
        		break;
        	default:
        		node.error("invalid selection "+node.selection);
        }

        node.on('input', function (msg) {
        	setPath();
        	var o=Array(node.outputs).fill(null).fill(msg,node.path-1,node.path);
			node.send(o);
        });
    }
    RED.nodes.registerType("Load Balance",loadBalanceNode);
};