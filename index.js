require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const moment = require('moment');

const Trade = require('./models/Trade'); // Ensure you have a Trade model defined

const app = express();
const PORT = process.env.PORT || 3000;

const mongoURI = `mongodb+srv://kajalsamal2018:Wiz5DQ4Mr4hRrx4Y@cluster0.kwhy5jh.mongodb.net/mycontacts-backend?retryWrites=true&w=majority`;

mongoose.connect(mongoURI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true 
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const trades = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            const [baseCoin, quoteCoin] = row.Market.split('/');
            trades.push({
                utcTime: new Date(row.UTC_Time),
                operation: row.Operation,
                market: row.Market,
                baseCoin,
                quoteCoin,
                amount: parseFloat(row['Buy/Sell Amount']),
                price: parseFloat(row.Price),
            });
        })
        .on('end', async () => {
            await Trade.insertMany(trades);
            fs.unlinkSync(filePath); // Delete the file after processing
            res.send('File uploaded and data saved to database.');
        });
});

app.use(express.json());

app.post('/balance', async (req, res) => {
    const { timestamp } = req.body;
    const date = moment(timestamp, 'YYYY-MM-DD HH:mm:ss').toDate();

    const trades = await Trade.find({ utcTime: { $lte: date } });

    const balances = trades.reduce((acc, trade) => {
        const { baseCoin, operation, amount } = trade;
        if (!acc[baseCoin]) {
            acc[baseCoin] = 0;
        }
        acc[baseCoin] += operation === 'BUY' ? amount : -amount;
        return acc;
    }, {});

    res.json(balances);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
