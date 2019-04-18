
var setPaths={
	random:	function() {
			this.path=Math.floor(Math.random()*this.outputs);
	},
	next: function() {
		if(--this.path<0) {
			this.path=this.outputs-1;
		}   
	},
	foldweighted: function() {
		for(this.path=0;this.path<this.outputs;this.path++) {
			if(this.paths[this.path].capacity>0) return;
		}
		this.random();
	},
	nextsmoothed:function() {
		for(var i=0;i<this.outputs;i++) {
        	if(--this.path<0) {
        		this.path=this.outputs-1;
       		}
			if(this.paths[this.path].capacity>=this.pathCapacityAvg) return;
		}
	},
	dropmessage:function() {
		this.path=this.outputs;  // by placing on none existence wire
	}
}


module.exports = function(RED) {
    function loadBalanceNode(n) {
        RED.nodes.createNode(this,n);
        var node=Object.assign(this,{path:0},n);
        node.paths=[];
        for(var i=0;i<node.outputs;i++) {
        	node.paths.push({status:0,capacity:100,count:0,history:Array(3).fill({count:0,capacity:0})})
        }
        node.pathCapacityAvg=100;
		var setPath = function() {
			node.path=Math.floor(Math.random()*node.outputs);
		};
		try{
			var setPath=setPaths[node.selection];
		} catch(e) {
			node.error("Selection mode not found: "+node.selection);
		}
        node.on('input', function (msg) {
            switch (msg.topic) {
        		case 'loadbalance':
        			try {
        				if(Array.isArray(msg.payload)) {
        					for(var a in msg.payload) {
        						node.paths[a.path].capacity=a.capacity;
        					}
        				} else {
        					node.paths[msg.payload.path].capacity=msg.payload.capacity;
        				}
        			} catch(e) {
        				node.error("loadbalance update failed");
        			}
        			for(var t=0,i=0;i<node.outputs;i++) {
        				t+=node.paths[i].capacity
        			}
        			node.pathCapacityAvg=t/node.outputs;
        			node.send();
        			return;
        		case 'loadbalancedebug':
    				node.error("selection mode: "+node.selection+"path pointer: "+node.path+" average capacity: "+node.pathCapacityAvg +" "+JSON.stringify(node.paths));
    				node.send();
        			return;
            }
        	setPath.apply(this);
        	node.paths[node.path].count++;
        	var o=Array(node.outputs).fill(null).fill(msg,node.path,node.path+1);
			node.send(o);
        });
        function checkLoop() { 
        	for(var n,i=0;i<node.outputs;i++) {
        		n=node.paths[node.path];
        		n.history.unshift({status:n.status,count:n.count,capacity:n.capacity});
        		n.history.pop();
        		n.count=0;
        	}
        }
        node.check = setInterval(checkLoop, 60000); // check every minute 
        node.on("close", function(removed,done) {
        	clearInterval(node.check);
        	done();
        });
    }
    RED.nodes.registerType("Load Balance",loadBalanceNode);
};