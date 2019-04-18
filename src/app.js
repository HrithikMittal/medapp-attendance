const ejs = require("ejs")
const path = require("path")
const express = require("express")
const helmet = require("helmet")
const db = require("./db/mongoose.js")
const session = require("express-session")
const messages = require("express-messages")
const flash = require("connect-flash")
const employeeRoute = require("./routes/employeeRoute")
const adminRoute = require("./routes/adminRoute")

const app = express()

//set the development environment port
const port = process.env.PORT || 3000

const viewsPath = path.join(__dirname, "/views")

app.use(express.static(path.join(__dirname, "/public")))

app.use(helmet())

app.use(express.urlencoded({ extended: true}))

//setup express-session middleware
app.use(session({
  secret: 'Xy12MIbneRt Un2w',
  resave: true,
  saveUninitialized: true,
  cookie: {
  	httpOnly: true,
  	expires: new Date(Date.now() + 60 * 60 * 1000)
  }
}));

//set the view engine to ejs
app.set("view engine", "ejs")
app.set("views", viewsPath)

//setup express-messages middleware
app.use(flash());
app.use(function (req, res, next) {
  res.locals.messages = messages(req, res)
  next();
});

//setup global errors variable
app.locals.errors = null;

app.use("/employee", employeeRoute)
app.use("/medapp-attendance-admin", adminRoute)

app.get("/", (req, res) => {
  res.render("index.ejs", {
    pageTitle: "Home | Attendance App"
  })
})

app.listen(port, (req, res) => {
  console.log(`Server started at port ${port}..`)
})
