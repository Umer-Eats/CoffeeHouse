# CoffeeHouse

**Chat. Study. Grow. Together.**

A cozy online café for students to find their community, work through difficult questions, and make time to focus. CoffeeHouse brings school conversations, AI study companions, personal notes, and a playful focus timer into one pixel-art space.

**[Visit CoffeeHouse →](https://www.coffee-house.app/)**

## Pull up a chair

Studying can start with a quick question, a conversation with a classmate, or a quiet stretch of work. CoffeeHouse gives each of those moments a place.

Meet your classmates in **Student Hall**, bring your questions to **Study Corner**, or choose a drink in **Matcha Mode** and settle into a focus session. Switch between a warm daytime café and a moonlit night scene, with music to keep you company.

## Find your people in Student Hall

Stay connected to your school community through shared rooms and direct messages. Ask for homework help, compare ideas, find other students, and create groups for working together.

- Join conversations in your community's rooms.
- Find classmates in the student directory and message them directly.
- Share files and keep project conversations together.

[Explore Chat →](https://www.coffee-house.app/chat.html)

## Turn questions into understanding

**Study Corner** gives you two AI companions with different jobs:

- **Barista** helps explain concepts, answer questions, and create study cheat sheets. Attach an image or screenshot to give your question context.
- **Brewer** turns source material into organized study notes. Bring text, a conversation feed, images, or a PDF study guide up to **20 MB**.

Return to your saved cheat sheets and study documents when it is time to review. Use the **Notepad** to keep your own thoughts, reminders, and working notes nearby, with automatic saving.

[Explore Study →](https://www.coffee-house.app/study.html)

## Make focus a little ritual

**Matcha Mode** turns a study session into a café order. Open a paper-textured workspace, browse illustrated drinks, and choose how long you want to focus.

1. Choose an unlocked drink. Each drink has a fixed focus time between **5 minutes and 2 hours**, the same for every user.
2. Add a topping or write a special instruction—perhaps the task you want to finish.
3. Place your order and tear off the receipt to start the timer.
4. Work while your drink's brewing animation plays above the countdown.
5. Complete five sessions for a drink, then redeem its coupon to unlock the next drink in that collection.

Want to encourage a friend? Choose **Send to Friend** on your receipt and select someone in your community. They receive the drink in their direct messages. When they finish its timer, **both of you earn a full coupon for that drink**.

Drinks and coupons are digital focus rewards. Regular Matcha progress stays in your browser; completed gift rewards are stored with your account.

[Explore Matcha Mode →](https://www.coffee-house.app/matcha.html)

## Make yourself at home

Choose your display name, manage your school community, and switch between Day and Night themes. The café's pixel artwork, animated scenery, and music give you a space to return to between classes and during study sessions.

[Explore Profile →](https://www.coffee-house.app/profile.html)

## Get started

1. Visit **[coffee-house.app](https://www.coffee-house.app/)**.
2. Explore the feature pages and scrollable previews without signing in.
3. Sign in with Google and join your school community using its community password.
4. Start a conversation, bring a question to Study Corner, or order your first focus drink.

**Your next idea deserves a place to grow. See you at CoffeeHouse.**

---

## For developers

CoffeeHouse uses Node.js, Express, Firebase Authentication, libSQL/Turso, and Gemini, with a vanilla HTML, CSS, and JavaScript frontend.

For configuration and implementation details, see:

- [Application structure and configuration](Documents/Web-structure.md)
- [Visual design and interaction guidelines](Documents/Wizard-UI-style.md)
- [Matcha Mode behavior and gift rewards](Documents/MATCHA-MODE.md)

With Node.js 24 and the required environment configuration in place:

```sh
npm install
npm run build
npm run dev
```

Run the test suite with `npm test`.
