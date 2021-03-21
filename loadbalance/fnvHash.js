const textEncoder = new TextEncoder();
function fnv (size=32) {
	if(size==32) this.hash=this.fnv1_32_Hash
	else throw Error("invalid size")
}
fnv.prototype.setMax=function(s) {
	this.maxSize=s;
	console.log("setmax")
//	this.hash=(k)=>{const r=this.fnv1_32_Hash(k)%this.maxSize;console.log({r:r,maxSize:this.maxSize});return r}
	this.hash=(k)=>this.fnv1_32_Hash(k)%this.maxSize
	return this
}
fnv.prototype.fnv1_32_Hash=function(k) {
	const prime=0x01000193;
	const offset=0x811c9dc5;
	const ar=textEncoder.encode(k);
	const hash=ar.reduce((a,c)=>(a*prime)^c ,offset);
	return hash<0?-hash:hash;
}
fnv.prototype.fnv1_Hash=function(k) {
	const ar=textEncoder.encode(k);
	const hash=ar.reduce((a,c)=>(a*this.prime)^c ,this.offset);
	return hash<0?-hash:hash;
}
fnv.prototype.fnv1a_Hash=function(k) {
	const ar=textEncoder.encode(k);
	const hash=ar.reduce((a,c)=>(a*c)^this.prime ,this.offset);
	return hash<0?-hash:hash;
}
fnv.prototype.hashFunction=function() {
	return this.hash.bind(this)
}
module.exports=fnv
/*
function fnv (size) {
	this.prime=this.base[size]
	this.offset=this.base[size]
}
fnv.prototype.base={
		32:{prime: Int8Array.from(0x01000193),
			offset:Int8Array.from(0x811c9dc5)},		
		64:{prime: Int8Array.from(0x00000100000001B3),
			offset:Int8Array.from(0xcbf29ce484222325)},		
		128:{prime: Int8Array.from(0x0000000001000000000000000000013B),
			offset:Int8Array.from(0x6c62272e07bb014262b821756295c58d)},		
		256:{prime:Int8Array.from(0x0000000000000000000001000000000000000000000000000000000000000163),
			offset:Int8Array.from(0xdd268dbcaac550362d98c384c4e576ccc8b1536847b6bbb31023b4c8caee0535)},
		512:{prime:Int8Array.from(0x00000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000157),
			offset:Int8Array.from(0xb86db0b1171f4416dca1e50f309990acac87d059c90000000000000000000d21e948f68a34c192f62ea79bc942dbe7ce182036415f56e34bac982aac4afe9fd9)},
		1024:{prime: Int8Array.from(0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000018D),
				offset:Int8Array.from(0x0000000000000000005f7a76758ecc4d32e56d5a591028b74b29fc4223fdada16c3bf34eda3674da9a21d9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004c6d7eb6e73802734510a555f256cc005ae556bde8cc9c6a93b21aff4b16c71ee90b3)},		
}
*/