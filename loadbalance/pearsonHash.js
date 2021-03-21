const textEncoder = new TextEncoder();

function pearsonHash(t) {
	if(t==null) {
		this.T = Array(255).fill().map((_, index) => index);
		this.T.sort(() => Math.random() - 0.5);
	} else if(Number.isInteger(t)) {
			if(t<1 || t>256) throw Error("Only number between 1 and 256 allowed for size");
			this.T = Array(255).fill().map((_, index) => index%t);
			this.T.sort(() => Math.random() - 0.5);
	} else throw Error("Unrecognised table type");
	return this
}
pearsonHash.prototype.hash=function(v) {
	const ar=textEncoder.encode(v),l=Int8Array.of(ar.length)[0];
//	console.log({ar:ar,l:l})
	return ar.reduce((a,c)=> this.T[a ^ c],l);
/*	return ar.reduce((a,c)=>{ 
		console.log({a:a,c:c,ac:a ^ c,T:this.T[a ^ c]})
		return this.T[a ^ c]
	}
	,l);
*/
}
pearsonHash.prototype.hashFunction=function() {
	return this.hash.bind(this)
}
module.exports=pearsonHash