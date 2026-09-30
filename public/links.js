export function validatePlaces(input){
  if(!Array.isArray(input)||input.length>60)throw new Error('Keep up to 60 places per trip.');
  const ids=new Set();
  return input.map(p=>{
    if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(p.id)||ids.has(p.id))throw new Error('This place list has an invalid or duplicate ID.');
    ids.add(p.id);
    for(const [key,min,max] of [['name',1,90],['address',3,350],['localName',0,90]]){
      if(typeof p[key]!=='string'||p[key].trim().length<min||p[key].length>max)throw new Error('Each place needs a name and a full address.');
    }
    return {id:p.id,name:p.name.trim(),localName:p.localName.trim(),address:p.address.trim()};
  });
}
export function directionsLink(from,to,mode='transit'){
  if(!to?.address)return 'https://www.google.com/maps';
  const url=new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api','1');
  if(from?.address)url.searchParams.set('origin',from.address);
  url.searchParams.set('destination',to.address);
  url.searchParams.set('travelmode',['transit','driving','walking'].includes(mode)?mode:'transit');
  return url.href;
}
export function destinationLink(to){const url=new URL('https://www.google.com/maps/search/');url.searchParams.set('api','1');url.searchParams.set('query',to.address);return url.href;}
export function encodePlaces(places){const bytes=new TextEncoder().encode(JSON.stringify(validatePlaces(places)));return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function decodePlaces(value){
  if(typeof value!=='string'||value.length>140000||!/^[\w-]+$/.test(value))throw new Error('This shared place list is not valid.');
  try{const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));return validatePlaces(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))));}
  catch{throw new Error('This shared place list could not be read. Ask for a new link.');}
}
