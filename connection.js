// const mysql = require('mysql2');
import mysql from 'mysql2/promise';

const trgPool = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'nextfirmware'
})
const specPool = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'spec_line'
})

// const trgPool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'nextfirmware'
// })
// const specPool = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: '',
//   database: 'spec_line'
// });

export { specPool, trgPool };
