export type NutritionAssessment = {
  age: string; weight: string; height: string; sex: '' | 'female' | 'male'; activity: string;
  special: boolean; goal: string; context: string; kcal: string; protein: string; fat: string;
  energyAdjustment: string; proteinRate: string; fatPercent: string;
}
export const emptyAssessment = (): NutritionAssessment => ({age:'',weight:'',height:'',sex:'',activity:'',special:false,goal:'',context:'',kcal:'',protein:'',fat:'',energyAdjustment:'0',proteinRate:'1.6',fatPercent:'30'})
export function estimateEnergy(a: NutritionAssessment) {
  const age=Number(a.age),weight=Number(a.weight),height=Number(a.height),factor=Number(a.activity)
  if(a.special || !Number.isInteger(age) || age<18 || age>100 || weight<30 || weight>300 || height<120 || height>230 || ![age,weight,height].every(Number.isFinite) || !['female','male'].includes(a.sex)) return null
  const resting=10*weight+6.25*height-5*age+(a.sex==='male'?5:-161)
  return {resting:Math.round(resting), maintenance: [1.2,1.375,1.55,1.725,1.9].includes(factor)?Math.round(resting*factor):null}
}
export function estimateMacros(a: NutritionAssessment) {
  if(!a.kcal || !a.protein || !a.fat) return null
  const kcal=Number(a.kcal),protein=Number(a.protein),fat=Number(a.fat)
  if(![kcal,protein,fat].every(Number.isFinite)||kcal<=0||protein<0||fat<0) return null
  const remaining=kcal-protein*4-fat*9
  return remaining<0?null:{carbs:Math.round(remaining/4),protein,fat,kcal}
}

// Starting point for healthy active adults, not a therapeutic prescription.
// ACSM/AND/DC 2016: protein 1.2–2 g/kg/day, fat 20–35% of energy.
// 1.6 g/kg and 30% are explicit app defaults within those ranges.
export function calculateNutrition(a: NutritionAssessment) {
  const energy=estimateEnergy(a)
  if(!energy?.maintenance) return null
  const adjustment=Number(a.energyAdjustment),rate=Number(a.proteinRate),percent=Number(a.fatPercent)
  if(!['-10','0','10'].includes(a.energyAdjustment)||![1.2,1.6,2].includes(rate)||![20,25,30,35].includes(percent))return null
  const kcal=Math.round(energy.maintenance*(1+adjustment/100)), protein=Math.round(Number(a.weight)*rate), fat=Math.round(kcal*percent/100/9)
  const macros=estimateMacros({...a,kcal:String(kcal),protein:String(protein),fat:String(fat)})
  if(!macros || macros.carbs<=0 || protein*4/kcal>0.35) return null
  return {...energy,...macros}
}
