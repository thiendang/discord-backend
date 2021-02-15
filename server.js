import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import mongoData from './mongoData.js';
import Pusher from 'pusher'
import dotenv from 'dotenv'

dotenv.config()

// app config
const app = express();
const port = process.env.PORT;

// pusher
const pusher = new Pusher({
  appId: process.env.PORT,
  key: process.env.KEY,
  secret: process.env.SECRET,
  cluster: "ap1",
  useTLS: true
});

// middleware
app.use(express.json());
app.use(cors());

// db config
const mongoURI =
  `mongodb+srv://admin:${process.env.MONGODB_PASS}@cluster0.qrgy8.mongodb.net/discordDB?retryWrites=true&w=majority`;

mongoose.connect(mongoURI, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.once('open', () => {
  console.log('DB connected')

  const changeStream = mongoose.connection.collection('conversations').watch()

  changeStream.on('change', change => {
    if (change.operationType === 'insert') {
      pusher.trigger('channels', 'newChannel', {
        'change': change
      })
    } else if (change.operationType === 'update') {
      pusher.trigger('conversation', 'newMessage', {
        'change': change
      })
    } else {
      console.log('Error triggering Pusher')
    }
  })
})

// api routes
app.get('/', (req, res) => res.status(200).send('Hello'));

app.get('/get/channelList', (req, res) => {
  const dbData = req.body;
  mongoData.find(dbData, (err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      let channels = [];
      data.map((channelData) => {
        const channelInfo = {
          id: channelData._id,
          name: channelData.channelName,
        };
        channels.push(channelInfo);
      });
      res.status(200).send(channels);
    }
  });
});

app.get('/get/data', (req, res) => {
  mongoData.find((err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(data);
    }
  });
});

app.get('/get/conversation', (req, res) => {
  const id = req.query.id
  mongoData.find({ _id: id }, (err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send(data);
    }
  });
});

app.post('/new/channel', (req, res) => {
  const dbData = req.body;
  mongoData.create(dbData, (err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(201).send(data);
    }
  });
});

app.post('/new/message', (req, res) => {
  const newMessage = req.body;
  mongoData.update(
    {
      _id: req.query.id,
    },
    {
      $push: { conversation: req.body },
    },
    (err, data) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(201).send(data);
      }
    }
  );
});

// listen
app.listen(port, () => console.log(`listening on localhost port: ${port}`));
