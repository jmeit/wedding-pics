const express = require('express')
const app = express()
const port = process.env.DEVELOPMENT ? 3000 : 443

app.get('/', (req, res) => {
  res.sendFile(`${process.cwd()}/frontend/home.html`)
})

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
