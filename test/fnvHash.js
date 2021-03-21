const assert=require('assert');
const FnvHash=require("../loadbalance/fnvHash"); 
const all="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLIMOPQRSTUVWXYZ!@#$%^&*(){}[]|<>?"
describe("fnv 32 Hash", function() {
	const fnvHash=new FnvHash(32);
//	const hash=fnvHash.hash.bind(fnvHash);
	const hash=fnvHash.hashFunction();
	const abc=hash("abc");
	console.log("hash abc: "+abc)
	it('same', function(done) {
		assert.strictEqual(abc,hash("abc"));
		assert.strictEqual(hash("a"),hash("a"));
		assert.strictEqual(hash("d"),hash("d"));
		assert.strictEqual(hash("ab"),hash("ab"));
		assert.strictEqual(hash(all),hash(all));
		done();
	});
	it('different', function(done) {
		assert.notEqual(abc,hash("ABC"));
		assert.notEqual(abc,hash("abe"));
		assert.notEqual(abc,hash("ab"));
		assert.notEqual(abc,hash("a"));
		assert.notEqual(abc,hash("abcd"));
		assert.notEqual(abc,hash("bbc"));
		done();
	});
	it('defined T errors', function(done) {
		assert.throws(()=>new FnvHash("bbb"), {name: 'Error',message: 'invalid size'});
		assert.throws(()=>new FnvHash(4),  {name: 'Error',message: "invalid size"});
		done();
	});
	it('setMax ', function(done) {
		const a4=[0,1,2,3,4];
		fnvHash.setMax(4);
		const hash=fnvHash.hashFunction();
		
		let results=[0,0,0,0,0]
		all.split('').forEach(c=>results[hash(c)]++);
		all.split('').forEach((c,i)=>results[hash(c+all.substring(0,i))]++);
		all.split('').forEach((c,i)=>results[hash(all.substring(i))]++);
		console.log(results);
		const bc=hash("bc");
		console.log("bc: ",bc)
		assert.ok(a4.includes(bc));
		done();
	});
});