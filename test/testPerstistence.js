const assert=require('assert');
const should=require("should");
const loadBalance=require("../loadbalance/loadbalance.js");
const helper=require("node-red-node-test-helper");
helper.init(require.resolve('node-red'));
const helperNodeResults={id:"helperNodeResults",type: "helper"}
const helperNodeRoute1={id:"helperNodeRoute1",	type: "helper"}
const helperNodeRoute2={id:"helperNodeRoute2",	type: "helper"}
const helperNodeRoute3={id:"helperNodeRoute3",	type: "helper"}

const router={
    "id": "routerNode",
    "type": "Load Balance",
    "defaultcapacity": "100",
    "mps": "",
    "name": "round robin",
    "outputs": 4,
    "routes": "3",
    "selection": "next",
    "wires": [
        ["helperNodeResults"],
        ["helperNodeRoute1"],
        ["helperNodeRoute2"],
        ["helperNodeRoute3"]
    ]
};

function getNode(node) {
	const n=helper.getNode(node.id);
	if(n) return n; 
	throw Error("node id: "+node.id+"  not found, node: "+JSON.stringify(node))
};
describe('load balance functions', function() {
	it("cloneProperties", function(done) {
		console.log({a:1,b:"b",c:[1,2],d:{p:"test",l2:{l3:3}}}.cloneProperties("b","c","d"));
		done();
	});
});
describe('load balance', function() {
	beforeEach(function(done) {
		helper.startServer(done);
	});
	afterEach(function(done) {
		helper.unload();
		helper.stopServer(done);
	});
	it("test loading", function(done) {
		const routerLoad={
			"id": "routerLoad",
			"type": "Load Balance"
		};
		helper.load(loadBalance,[routerLoad], function() {
            try{
                const nodeRouter=getNode(routerLoad);
                done();
			} catch(ex) {
				done(ex);
			}
        });
    });
    const flow=[router,helperNodeResults,helperNodeRoute1,helperNodeRoute2,helperNodeRoute3]
	it("test1", function(done) {
		let count=0;
		helper.load(loadBalance,flow, function() {
			try{
				const nodeResults=getNode(helperNodeResults);
				const nodeRoute1=getNode(helperNodeRoute1);
				const nodeRoute2=getNode(helperNodeRoute2);
				const nodeRoute3=getNode(helperNodeRoute3);
			    const nodeRouter=getNode(router);
				nodeRouter.should.have.property("selection", "next");
				nodeResults.on("input", function(msg) {
					console.log("***** nodeResults "+JSON.stringify(msg));
                    if(--count==0) done()
				});
				nodeRoute1.on("input", function(msg) {
					console.log("***** nodeRoute1 "+msg.payload);
                    if(--count==0) done()
				});
				nodeRoute2.on("input", function(msg) {
					console.log("***** nodeRoute2 "+msg.payload);
                    if(--count==0) done()
				});
				nodeRoute3.on("input", function(msg) {
					console.log("***** nodeRoute3 "+msg.payload);
                    if(--count==0) done()
				});
				count++;nodeRouter.receive({topic:"loadbalance.list"});
				count++;nodeRouter.receive({payload:"test1"});
				count++;nodeRouter.receive({payload:"test2"});
				count++;nodeRouter.receive({payload:"test3"});
				count++;nodeRouter.receive({topic:"loadbalance.list"});
				count++;nodeRouter.receive({topic:"loadbalance.saveDetails"});
			} catch(ex) {
				done(ex);
			}
		});
	}).timeout(1000);
});