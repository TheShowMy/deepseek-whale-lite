// DeepSeek official pricing + 国办发明电〔2025〕7号, verified 2026-10-10.
export interface PricingSnapshot {status:'peak'|'off-peak'|'unknown';nextAt:number|null;calendarYear:number;holidays:string[]}
const ranges=[['01-01','01-03'],['02-15','02-23'],['04-04','04-06'],['05-01','05-05'],['06-19','06-21'],['09-25','09-27'],['10-01','10-07']]
export const HOLIDAYS=ranges.flatMap(([start,end])=>{const days:string[]=[];for(let n=Date.parse('2026-'+start+'T00:00:00Z');n<=Date.parse('2026-'+end+'T00:00:00Z');n+=86400000)days.push(new Date(n).toISOString().slice(0,10));return days})
export function period(at:number):PricingSnapshot['status'] {
  const d=new Date(at+8*3600000),day=d.toISOString().slice(0,10),h=d.getUTCHours()
  if([0,6].includes(d.getUTCDay())||!((h>=9&&h<12)||(h>=14&&h<18)))return 'off-peak'
  if(d.getUTCFullYear()!==2026)return 'unknown'
  return HOLIDAYS.includes(day)?'off-peak':'peak'
}
export function pricingSnapshot(at=Date.now()):PricingSnapshot {
  const status=period(at);let nextAt:number|null=null
  if(status!=='unknown')for(let n=Math.floor(at/3600000)*3600000+3600000;n<=at+8*86400000;n+=3600000){if(period(n)!==status){nextAt=n;break}}
  return {status,nextAt,calendarYear:2026,holidays:HOLIDAYS}
}
