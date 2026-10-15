// Gradient palettes from MeteorNOX/main fce34e3, assets/whale-widget.js (MIT).
export const PALETTES={
  rainbow:'linear-gradient(90deg,#e665b5,#77a2ed,#71b6a1,#e665b5)',
  'legacy-macaron':'linear-gradient(90deg,#e69aae,#9fafe7,#8ec6c3,#e69aae)',
  'legacy-bamboo':'linear-gradient(90deg,#57a165,#a6d09a,#57a165)',
  macaron:'linear-gradient(90deg,rgb(255,180,200),rgb(255,205,170),rgb(255,225,165),rgb(245,240,180),rgb(190,240,210),rgb(180,230,245),rgb(190,215,250),rgb(220,200,245),rgb(240,200,230),rgb(255,180,200))',
  candy:'linear-gradient(90deg,rgb(255,145,170),rgb(255,170,130),rgb(255,195,110),rgb(240,220,115),rgb(140,220,175),rgb(115,210,205),rgb(130,195,240),rgb(160,170,235),rgb(210,155,230),rgb(235,135,190),rgb(255,145,170))',
  rouge:'linear-gradient(90deg,rgb(140,25,45),rgb(175,35,60),rgb(120,20,55),rgb(160,40,75),rgb(190,55,80),rgb(130,30,65),rgb(140,25,45))',
  bamboo:'linear-gradient(90deg,rgb(70,180,85),rgb(95,200,105),rgb(55,165,70),rgb(110,215,120),rgb(80,190,95),rgb(60,172,78),rgb(70,180,85))',
  aurora:'linear-gradient(90deg,rgb(70,240,200),rgb(90,200,255),rgb(120,140,255),rgb(180,120,255),rgb(240,140,255),rgb(70,240,200))',
  deepsea:'linear-gradient(90deg,rgb(20,90,180),rgb(30,140,210),rgb(40,180,220),rgb(20,120,190),rgb(50,160,230),rgb(25,100,200),rgb(20,90,180))',
  sunset:'linear-gradient(90deg,rgb(255,180,80),rgb(255,130,90),rgb(255,90,110),rgb(220,90,150),rgb(160,90,190),rgb(255,180,80))',
  forest:'linear-gradient(90deg,rgb(30,100,60),rgb(60,140,80),rgb(90,180,90),rgb(140,200,80),rgb(180,210,90),rgb(30,100,60))',
  champagne:'linear-gradient(90deg,rgb(220,180,100),rgb(240,205,130),rgb(255,225,160),rgb(230,190,110),rgb(245,210,140),rgb(220,180,100))',
  lavender:'linear-gradient(90deg,rgb(180,150,255),rgb(200,170,255),rgb(230,180,240),rgb(255,190,220),rgb(240,160,200),rgb(180,150,255))',
  mint:'linear-gradient(90deg,rgb(120,230,180),rgb(150,240,200),rgb(170,240,230),rgb(140,220,240),rgb(120,200,220),rgb(120,230,180))',
  lava:'linear-gradient(90deg,rgb(255,60,40),rgb(255,110,30),rgb(255,170,40),rgb(255,210,70),rgb(255,140,50),rgb(255,60,40))',
  galaxy:'linear-gradient(90deg,rgb(40,30,90),rgb(70,50,130),rgb(110,70,170),rgb(160,90,190),rgb(220,120,180),rgb(40,30,90))',
  ink:'linear-gradient(90deg,rgb(20,20,20),rgb(80,80,80),rgb(140,140,140),rgb(200,200,200),rgb(250,250,250),rgb(250,250,250),rgb(200,200,200),rgb(140,140,140),rgb(80,80,80),rgb(20,20,20))',
  indigo:'linear-gradient(90deg,rgb(32,49,112),rgb(52,76,146),rgb(74,102,180),rgb(100,126,210),rgb(130,132,224),rgb(130,132,224),rgb(100,126,210),rgb(74,102,180),rgb(52,76,146),rgb(32,49,112))',
  blaze:'linear-gradient(90deg,rgb(150,15,25),rgb(200,30,30),rgb(240,70,25),rgb(255,130,30),rgb(255,200,60),rgb(255,240,170),rgb(255,200,60),rgb(255,130,30),rgb(240,70,25),rgb(200,30,30),rgb(150,15,25))',
  amber:'linear-gradient(90deg,rgb(230,90,0),rgb(255,140,0),rgb(255,180,0),rgb(255,215,40),rgb(255,240,120),rgb(255,215,40),rgb(255,180,0),rgb(255,140,0),rgb(230,90,0))',
} as const
export type Gradient='none'|keyof typeof PALETTES
export const GRADIENT_OPTIONS:readonly (readonly [Gradient,string])[]=[['none','无'],['rainbow','彩虹（Lite）'],['macaron','马卡龙'],['candy','糖果'],['rouge','胭脂'],['bamboo','竹绿'],['aurora','极光'],['deepsea','深海'],['sunset','夕阳'],['forest','森林'],['champagne','香槟'],['lavender','薰衣草'],['mint','薄荷'],['lava','熔岩'],['galaxy','银河'],['ink','墨韵黑白'],['indigo','靛蓝夜曲'],['blaze','火红烈焰'],['amber','警示橙黄'],['legacy-macaron','马卡龙（0.2）'],['legacy-bamboo','竹绿（0.2）']]
