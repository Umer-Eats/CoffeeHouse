/* Menu snapshot: 2026-09-22. See Documents/MATCHA-MODE.md for sources. */
(function(root){
'use strict';
const groups = [
 ['Top picks',[
 ['Slim Boost Tea',4.80,'A light tea with a fresh, clean finish.','#9aaf62','leaf'],
 ['Guava Green Grape',5.20,'Guava and green grape, bright and juicy.','#eda2a7','fruit'],
 ['Cloud Jasmine Tea (Original)',5.49,'Fragrant jasmine beneath a soft foam cap.','#c8ce8a','cloud'],
 ['Green Grape Boom',5.50,'Green grape meets a crisp tea base.','#b6ca64','fruit'],
 ['Jasmine Milk Tea',7.49,'Floral jasmine softened with milk.','#e4d3a2','milk'],
 ['Coconut Mango Blue',8.49,'Mango and coconut in a tropical blue blend.','#88c4ce','layer'],
 ['Coconut Mango Boom',8.99,'Mango, coconut and refreshing fruit tea.','#ffc55c','layer'],
 ['Crisp Grape Boom',9.49,'A juicy grape tea with a refreshing finish.','#b6b8df','fruit'],
 ['Cloud Longjing Milk Tea',9.49,'Longjing tea and milk with a cloud topping.','#c7bf8a','cloud'],
 ['Triple Supreme Matcha Latte',9.99,'A rich, layered matcha and milk drink.','#728b3d','layer'],
 ['Coconut Mango Boom (Large)',9.99,'A larger serving of tropical mango and coconut.','#f6bd4f','layer'],
 ['Kale Boost Tea',9.99,'A green tea drink with kale.','#517b45','leaf'],
 ['Crisp Grape Boom (Large)',10.99,'A larger cup of crisp grape tea.','#a89cca','fruit']]],
 ['In season',[
 ['Pineapple Aloe Chill',4.60,'Pineapple with cool, tender aloe pieces.','#e9cb55','fruit'],
 ['Guava Green Grape',4.70,'Pink guava with grape and fruit pieces.','#e2a4ac','fruit'],
 ['Lychee Summer Brew',4.80,'Lychee tea with lemon and mint.','#dce8b3','fruit'],
 ['Cloud Coconut Blue',4.90,'Coconut and butterfly pea tea under milk foam.','#87c8df','cloud'],
 ['Strawberry Fizz',4.90,'Strawberry pieces in a sparkling drink.','#e79191','fruit'],
 ['Peachy Mango Ice',5.10,'Mango ice with peach syrup and pieces.','#edb969','layer'],
 ['Cloud Jasmine Tea (Original)',5.49,'Jasmine tea with a cloud of foam.','#bcc789','cloud'],
 ['Slim Boost Tea',7.49,'A light, refreshing tea selection.','#9db06c','leaf']]],
 ['Fruit teas',[
 ['Passion Fruit Blast',4.80,'Zesty passion fruit folded into tea.','#e5b841','fruit'],
 ['Green Grape Boom',4.90,'Grape juice and jasmine green tea.','#b8cb78','fruit'],
 ['Cloud Green Grape',5.20,'Green grape tea with creamy cheese foam.','#a9c276','cloud'],
 ['Cloud Jasmine Tea (Original)',5.49,'Floral tea with a creamy finish.','#d2d298','cloud'],
 ['Cloud Mango',6.49,'Mango tea beneath a fluffy foam cap.','#efbc57','cloud'],
 ['Cloud Mulberry Strawberry',7.49,'Berry tea with a creamy cloud topping.','#bc738c','cloud'],
 ['Mulberry Strawberry Boom',7.99,'Mulberry and strawberry blended with tea.','#c96a86','fruit'],
 ['Cloud Yumberry',7.99,'Tart yumberry tea topped with cheese foam.','#cd859e','cloud'],
 ['Yumberry Boom',7.99,'Tangy yumberry with a green tea base.','#b26381','fruit'],
 ['Grapefruit Boom (Original)',6.49,'Bright grapefruit tea with juicy citrus pulp.','#efb5a1','fruit'],
 ['Mulberry Boom',7.99,'Dark mulberry fruit in a refreshing tea.','#986083','fruit'],
 ['Coconut Mango Boom (Large)',9.99,'A big cup of mango and coconut tea.','#f1c456','layer']]],
 ['Milk teas',[
 ['Red Blossom Milk Tea',4.90,'A smooth milk tea with floral notes.','#d4b39c','milk'],
 ['Supreme Brown Sugar Bobo Milk Tea',4.95,'Brown sugar pearls in creamy milk tea.','#b88254','boba'],
 ['Supreme Roasted Brown Sugar Bobo Milk Tea',5.20,'Roasted caramel notes with brown sugar pearls.','#98714c','boba'],
 ['Jasmine Milk Tea',7.49,'Delicate jasmine fragrance in creamy milk.','#dacda3','milk']]],
 ['Tea lattes',[
 ['Jasmine Latte',4.80,'Jasmine tea and milk, light and floral.','#ddd5ad','milk'],
 ['Roasted Oolong Latte',5.00,'Toasty oolong balanced by smooth milk.','#ba9472','milk'],
 ['Golden Black Tea Latte',5.10,'Bold black tea rounded out with milk.','#c99e6c','milk'],
 ['Matcha Cloud Jasmine',5.20,'Jasmine and earthy matcha under a creamy cloud.','#a9bb70','cloud'],
 ['Peach Oolong Latte',5.30,'Peach notes with roasted oolong and milk.','#e4b093','layer'],
 ['Taro Purple Rice Latte',5.50,'Taro and purple rice in a creamy latte.','#b49bc9','boba']]],
 ['Matcha',[
 ['Matcha Jasmine Latte',4.50,'Floral jasmine, green matcha and milk.','#a8bd73','layer'],
 ['Cloud Matcha',4.80,'Earthy matcha capped with creamy cheese foam.','#829c51','cloud'],
 ['Supreme Matcha Latte',5.20,'An intense matcha latte with a creamy finish.','#668537','layer']]],
 ['Leaf teas',[
 ['Jasmine Latte',4.50,'A gentle jasmine tea with a milky finish.','#d8d0a0','milk'],
 ['Cloud Jasmine Tea (Original)',5.49,'Jasmine tea under a soft, creamy topping.','#c1ca8a','cloud'],
 ['Slim Boost Tea',7.49,'A light tea for a clean, refreshing sip.','#8eaa60','leaf']]]
];
const drinks=groups.flatMap(([category,rows],g)=>rows.map(([name,price,description,color,style],i)=>({id:`m${g}-${i}`,category,name,price,description,color,style,art:`/images/matcha/m${g}-${i}.svg`}))).sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id));
const menu={drinks,categories:groups.map(g=>g[0]),toppings:['Matcha Cloud','Grapefruit Pulp','Coconut Milk Jelly','Sago','Brown Sugar Bobo'],source:'https://www.heytea.com/'};
if(typeof module!=='undefined')module.exports=menu;else root.MatchaMenu=menu;
})(typeof window==='undefined'?{}:window);
