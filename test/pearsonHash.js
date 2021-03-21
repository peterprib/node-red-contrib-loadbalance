const assert=require('assert');
const PearsonHash=require("../loadbalance/pearsonHash"); 
const all="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLIMOPQRSTUVWXYZ!@#$%^&*(){}[]|<>?"
describe("Pearson Hash", function() {
	const pearsonHash=new PearsonHash();
	const hash=pearsonHash.hash.bind(pearsonHash);
	const abc=hash("abc");
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
		assert.throws(()=>new PearsonHash("aaa"), {name: 'Error',message: "Unrecognised table type"});
		assert.throws(()=>new PearsonHash(-1), {name: 'Error',message:"Only number between 1 and 256 allowed for size"});
		assert.throws(()=>new PearsonHash(0),	{name: 'Error',message:"Only number between 1 and 256 allowed for size"});
		assert.throws(()=>new PearsonHash(257), {name: 'Error',message:"Only number between 1 and 256 allowed for size"});
		done();
	});
	it('Size', function(done) {
		const PearsonHash1=new PearsonHash(1);
		const PearsonHash2=new PearsonHash(2);
		const PearsonHash256=new PearsonHash(256);
		const hash1=PearsonHash1.hash.bind(PearsonHash1);
		const hash2=PearsonHash1.hash.bind(PearsonHash2);
		const hash256=PearsonHash256.hash.bind(PearsonHash256);
		assert.strictEqual(hash1("abc"),hash1("cba"));
		assert.notEqual(hash256("abc"),hash256("cba"));
		const a1=[0]
		assert.ok(a1.includes(hash1("a")));
		assert.ok(a1.includes(hash1("b")));
		assert.ok(a1.includes(hash1("bc")));
		const a2=[0,1]
		assert.ok(a2.includes(hash2("a")));
		assert.ok(a2.includes(hash2("b")));
		assert.ok(a2.includes(hash2("bc")));
		done();
	});
});