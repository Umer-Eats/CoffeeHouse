const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('database timestamps convert from UTC to local time with daylight saving',()=>{
  for(const file of ['client.js','public/app.js']){
    const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    const start=source.indexOf('function fmtTime('),end=source.indexOf('const AVATAR_COLORS',start);
    for(const [zone,summer,winter] of [['America/New_York','12:01 am','11:01 pm'],['UTC','4:01 am','4:01 am'],['Asia/Kolkata','9:31 am','9:31 am']]){
      class LocalDate extends Date {
        parts(){return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(this);}
        getHours(){return Number(this.parts().find(p=>p.type==='hour').value);}
        getMinutes(){return Number(this.parts().find(p=>p.type==='minute').value);}
      }
      const context=vm.createContext({Date:LocalDate});vm.runInContext(source.slice(start,end),context);
      assert.equal(context.fmtTime('2026-09-16 04:01:00'),summer);
      assert.equal(context.fmtTime('2026-09-16T04:01:00Z'),summer);
      assert.equal(context.fmtTime('2026-01-16 04:01:00'),winter);
      assert.equal(context.fmtTime('invalid'),'Unknown time');
    }
  }
});
