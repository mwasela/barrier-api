var express = require('express');
var router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const redis = require('redis');
const client = redis.createClient();
var BarrierLogs = require('../models/BarrierLogs');
var Plates = require('../models/Plates');
var User = require('../models/User');
const authenticateToken = require("../middlewares/auth");
const { default: axios } = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path'); // Import the path module
const chokidar = require('chokidar');
const PDFDocument = require('pdfkit');
const { Op, BelongsTo } = require('sequelize');
//const { watchDirectory } = require('./watchDirectory'); // Assuming watchDirectory is defined elsewhere
const newFiles = [];
const MAX_CAR_DUMP_SIZE = 10; // Maximum number of entries in carDump
const logoPath = path.join(__dirname, '/logo.png');


//barrierlogs.user is a foreign key of User attributes blk_users_fname, blk_users_surname

BarrierLogs.belongsTo(User, {foreignKey: "createdby", as: "user"});

//API_URL='http://192.168.0.151/relay?state=on'
API_URL='http://192.168.0.7/relay?state=on'
// const app = express();

client.on('error', function (err) {
  console.log('Error ' + err);
});




let lastPlateNumber = '';
let carDump = [];

//USING EVENT WATCHER
// function watchDirectory(directoryPath) {
//     fs.watch(directoryPath, (eventType, filename) => {
//         if (eventType === 'rename') {
//             // File created or deleted
//             if (filename) {
//                 // New file created
//                 console.log(`New file created: ${filename}`);
//                 // Store the filename in the array
//                 newFiles.push(filename);
//                 // You can perform further operations with the filename here if needed
//             }
//         }
//     });
// }


//USING CHOKIDAR FILE LIBRARY
function watchDirectory(directoryPath) {
    const watcher = chokidar.watch(directoryPath, {
        persistent: true,
        ignored: /(^|[/\\])\../, // ignore dotfiles
        ignoreInitial: true, // do not emit 'add' event for existing files
    });

    watcher.on('add', (filePath) => {
        console.log(`New file created: ${filePath}`);
        newFiles.push(path.basename(filePath));
        // Additional operations with the filename if needed
    });

    watcher.on('error', (error) => {
        console.error(`Watcher error: ${error}`);
    });
}

// Express route to get the list of new files
// app.get('/new-files', (req, res) => {
//     res.json(newFiles);
// });


const BarrierTrigger = async () => {
  try {
    const response = await axios.get(API_URL);
    return response.status === 200 ? 200 : 500;
  } catch (err) {
    console.error(err);
    return 500;
  }
}

router.get('/pdflogs', async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Start date and end date are required' });
  }

  try {
    // Parse the date strings into Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    const records = await BarrierLogs.findAll({
      where: {
        createdAt: {
          [Op.between]: [start, end]
        }
      },
      include: [
        {
          model: User,
          as: "user", // Specify the alias used in the association
          attributes: ['blk_users_fname', 'blk_users_surname'] // Include only the needed attributes
        }
      ]
    });

    // Check and log the associated user data
    records.forEach((record) => {
      console.log(record.user);
    });

    if (!records.length) {
      return res.status(404).json({ message: 'No records found' });
    }

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' }); // Set to landscape orientation
    let buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res
        .status(200)
        .contentType('application/pdf')
        .send(pdfData);
    });

    // Add the logo at the top-left corner
    doc.image(logoPath, { fit: [100, 100], align: 'left', valign: 'top' });
    doc.moveDown();

    // Title and date range in the report header
    doc.fontSize(25).text('Gate D Barrier Security Logs Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`StartDate: ${new Date(startDate).toLocaleDateString()} ----- EndDate: ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(); // Move down to create space between the date range and the records

    // Add extra space
    doc.moveDown(2); // Add 2 lines of space (adjust as needed)

    // Define table headers
    const headers = ['ID', 'Plate Number', 'Direction', 'Created At', 'Created By', 'Comment'];

    // Set up table styles
    const tableTop = doc.y; // Start table after the space
    const itemSpacing = 20;
    const headerFontSize = 12;
    const rowFontSize = 10;
    const columnWidths = [50, 100, 70, 150, 100, 150]; // Added width for 'Comment' column

    // Draw headers
    let xPosition = 50; // Starting x position
    headers.forEach((header, i) => {
      doc.fontSize(headerFontSize).text(header, xPosition, tableTop);
      xPosition += columnWidths[i];
    });

    // Draw rows
    records.forEach((record, rowIndex) => {
      const yPosition = tableTop + (rowIndex + 1) * itemSpacing;
      const directionText = record.direction === 1 ? 'Gate In' : record.direction === 2 ? 'Gate Out' : 'N/A';
      const createdBy = record.user ? `${record.user.blk_users_fname} ${record.user.blk_users_surname}` : 'N/A';
      const comment = record.comment; // Get the comment text
      const row = [
        record.id,
        record.plateNumber,
        directionText, // Use conditional logic for direction
        new Date(record.createdAt).toLocaleString(), // Format createdAt as date and time
        createdBy,
        comment
      ];
      xPosition = 50; // Reset x position for each row
      row.forEach((value, i) => {
        doc.fontSize(rowFontSize).text(value, xPosition, yPosition);
        xPosition += columnWidths[i];
      });
    });

    doc.end();
  } catch (error) {
    console.error("Error fetching records:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// router.get('/pdflogs', async (req, res) => {
//   const { startDate, endDate } = req.query;

//   if (!startDate || !endDate) {
//     return res.status(400).json({ message: 'Start date and end date are required' });
//   }

//   try {
//     // Parse the date strings into Date objects
//     const start = new Date(startDate);
//     const end = new Date(endDate);

//     const records = await BarrierLogs.findAll({
//       where: {
//         createdAt: {
//           [Op.between]: [start, end]
//         }
//       },
//       include: {
//         model: User,
//         as: "user", // Specify the alias used in the association
//         attributes: ['blk_users_fname', 'blk_users_surname'] // Include only the needed attributes
//       }
//     });

//     // Check and log the associated user data
//     records.forEach((record) => {
//       console.log(record.user);
//     });

//     if (!records.length) {
//       return res.status(404).json({ message: 'No records found' });
//     }

//     const doc = new PDFDocument();
//     let buffers = [];
    
//     doc.on('data', buffers.push.bind(buffers));
//     doc.on('end', () => {
//       let pdfData = Buffer.concat(buffers);
//       res
//         .status(200)
//         .contentType('application/pdf')
//         .send(pdfData);
//     });

//     // Add the logo at the top-left corner
//     doc.image(logoPath, { fit: [100, 100], align: 'left', valign: 'top' });
//     doc.moveDown();

//     // Title and date range in the report header
//     doc.fontSize(25).text('Barrier Logs Report', { align: 'center' });
//     doc.moveDown();
//     doc.fontSize(12).text(`StartDate: ${new Date(startDate).toLocaleDateString()} ----- EndDate ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
//     doc.moveDown(); // Move down to create space between the date range and the records

//     // Add extra space
//     doc.moveDown(2); // Add 2 lines of space (adjust as needed)

//     // Define table headers
//     const headers = ['ID', 'Plate Number', 'Direction', 'Created At', 'Created By'];

//     // Set up table styles
//     const tableTop = doc.y; // Start table after the space
//     const itemSpacing = 20;
//     const headerFontSize = 12;
//     const rowFontSize = 10;
//     const columnWidths = [50, 100, 70, 150, 100];

//     // Draw headers
//     let xPosition = 50; // Starting x position
//     headers.forEach((header, i) => {
//       doc.fontSize(headerFontSize).text(header, xPosition, tableTop);
//       xPosition += columnWidths[i];
//     });

//     // Draw rows
//     records.forEach((record, rowIndex) => {
//       const yPosition = tableTop + (rowIndex + 1) * itemSpacing;
//       const directionText = record.direction === 1 ? 'Gate In' : record.direction === 2 ? 'Gate Out' : 'N/A';
//       const createdBy = record.user ? `${record.user.blk_users_fname} ${record.user.blk_users_surname}` : 'N/A';
//       const row = [
//         record.id,
//         record.plateNumber,
//         directionText, // Use conditional logic for direction
//         new Date(record.createdAt).toLocaleString(), // Format createdAt as date and time
//         createdBy
//       ];
//       xPosition = 50; // Reset x position for each row
//       row.forEach((value, i) => {
//         doc.fontSize(rowFontSize).text(value, xPosition, yPosition);
//         xPosition += columnWidths[i];
//       });
//     });

//     doc.end();
//   } catch (error) {
//     console.error("Error fetching records:", error);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// });





router.post('/relay', async function (req, res){

  const response =  await BarrierTrigger();

  if (response.status === 200 || response === 200 ) {
    //relay('on');
    return res.status(200).send("Barrier lifted successfully.");
  } else {
    return res.status(500).send("Error, Barrier Stalled.");
  }
});


const KenyanPlateAlg = (plate) => {
  const pattern = /^[A-Z]{3}\d{3}[A-Z]?$/;
  return pattern.test(plate) ? 0 : 1;
};

const TanzanianPlateAlg = (plate) => {
  const pattern = /^T\d{3}[A-Z]{3}$/;
  return pattern.test(plate) ? 0 : 1;
};





router.post('/AplateInfo', async function (req, res) {

        const jsonData = req.body;
        //console.log("payload", jsonData);
        const plateNumber = jsonData.Picture.Plate.PlateNumber;
        const snapTime = jsonData.Picture.SnapInfo.SnapTime;
        const DeviceID = jsonData.Picture.SnapInfo.DeviceID;

        console.log("Plate", plateNumber);
        console.log("SnapTime", snapTime);

        const KenyaTest = KenyanPlateAlg(plateNumber);
        const TzTest = TanzanianPlateAlg(plateNumber);

        if (KenyaTest !== 0 && TzTest !== 0) {
          return res.status(400).json({ message: 'Invalid plate format' });
        }

        try {
          // Check for existing record
          const existingPlate = await Plates.findOne({
            where: {
              blk_plates: plateNumber,
              blk_time: snapTime
            }
          });

          if (existingPlate) {
            // Record already exists
            return res.status(200).json(existingPlate);
          }

    // Create new record if it doesn't exist
        const newPlate = await Plates.create({
          blk_plates: plateNumber,
          blk_time: snapTime,
          blk_device: DeviceID
        });

    return res.status(200).json(newPlate);

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.post('/barrierLogs', authenticateToken, async function (req, res, next) {
  const data = req.body;
  console.log("Received data:", data);

  const theDirection = data.direction;
  const loggedIN = req.user.id;
  const comment = data.comment;
  const plateNumber = data.plateNumber;
  
  console.log("Direction:", theDirection);
  console.log("Logged in user ID:", loggedIN);
  console.log("Comment:", comment);
  console.log("Plate number:", plateNumber);

  try {
    const deviceID = theDirection == 1 ? 'bc2011f1-bea6-bcfc-324a-d91d4cf6bea6' : '07e3a3d1-a2f6-8ad3-0972-a92f41e2a2f6';
    console.log("Device ID:", deviceID);

    const loG = await BarrierLogs.create({
      plateNumber: plateNumber,
      plateColor: "Yellow",
      deviceID: deviceID,
      direction: theDirection,
      createdby: loggedIN,
      comment: comment
    });

    console.log("Barrier log created:", loG);

    // Lift Barrier
    const request = await BarrierTrigger();
    console.log("Barrier trigger response:", request);

    return res.status(200).json(loG);
  } catch (err) {
    console.error("Error creating barrier log:", err);
    return res.status(500).json({ message: err.message });
  }
});

  

router.get('/barrierLogs', authenticateToken, async function (req, res, next) {

  try {
    const logs = await BarrierLogs.findAll({
      include: { 
        model: User, attributes: 
      { exclude: ['blk_users_password'] } },
       order: [['createdAt', 'DESC']]
      // limit: pageSize, // Corrected the LIMIT to limit
      // offset: offset
    });
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/Plates', authenticateToken, async function (req, res) {
  const LIMIT = 10;

  try {
    const plates = await Plates.findAll({
      limit: LIMIT,
      order: [['id', 'DESC']]
    });
    return res.status(200).json(plates);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
});


router.post('/NotificationInfo/KeepAlive', async function (req, res, next) {
  const data = req.body;
  console.log("req data", data);
  return res.status(200).json("ok");
}
);


router.put('/plate', authenticateToken, async (req, res) => {

  const { _plate, _id } = req.body;

  console.log(req.body);

  try {
    const unit = await BarrierLogs.update({

      plateNumber: _plate

    }, {
      where: {
        id: _id
      }
    });

    return res.status(201).json({ message: 'Record updated successfully' });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message });
  }
}
);


router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
  const data = req.body;
  console.log("req data", data);
  // const plateNumber = data.Picture.Plate.PlateNumber;
  // const plateColor = data.Picture.Plate.PlateColor;
  // const deviceID = data.Picture.SnapInfo.DeviceID;
  // const direction = data.Picture.SnapInfo.Direction;

  // if (plateNumber !== lastPlateNumber) {
  //   // Store data in carDump array

  //   carDump.push({
  //     'plateNumber': plateNumber,
  //     'plateColor': plateColor,
  //     'deviceID': deviceID,
  //     'direction': direction
  //   });

  //   ///console.log("sawa");

  //   // Update lastPlateNumber
  //   lastPlateNumber = plateNumber;
  // }

  // // Logging plate number and color to the console
  // console.log("Plate Number:", plateNumber);
  // console.log("Plate Color:", plateColor);
  // console.log("Device ID:", deviceID);
  // console.log("Direction:", direction);

  // console.log("carDump", carDump);

  return res.status(200).json({ status: "ok" });
});


router.post('/ANotificationInfo/TollgateInfo', async function (req, res, next) {
  const data = req.body;
  console.log("req data", data);
  // const plateNumber = data.Picture.Plate.PlateNumber;
  // const plateColor = data.Picture.Plate.PlateColor;
  // const deviceID = data.Picture.SnapInfo.DeviceID;
  // const direction = data.Picture.SnapInfo.Direction;

  // if (plateNumber !== lastPlateNumber) {
  //   // Store data in carDump array

  //   carDump.push({
  //     'plateNumber': plateNumber,
  //     'plateColor': plateColor,
  //     'deviceID': deviceID,
  //     'direction': direction
  //   });

  //   ///console.log("sawa");

  //   // Update lastPlateNumber
  //   lastPlateNumber = plateNumber;
  // }

  // // Logging plate number and color to the console
  // console.log("Plate Number:", plateNumber);
  // console.log("Plate Color:", plateColor);
  // console.log("Device ID:", deviceID);
  // console.log("Direction:", direction);

  // console.log("carDump", carDump);

  return res.status(200).json({ status: "ok" });
});



// router.post('/ANotificationInfo/TollgateInfo', async function (req, res, next) {
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);

//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);

//       // Extract plateNumber from the filename
//       const match = filename.match(/__1__(.*?)__1__/);
//       if (match) {
//         const plateNumber = match[1];
        
//         // Check if the plate number is 'unlicensed', ignore the record
//         if (plateNumber !== 'Unlicensed') {
//           const deviceID = "07e3a3d1-a2f6-8ad3-0972-a92f41e2a2f6";
//           const direction = 2;

//           if (!carDump.some(item => item.plateNumber === plateNumber)) {
//             // If plate number doesn't exist in carDump, add it
//             if (carDump.length >= MAX_CAR_DUMP_SIZE) {
//               // Remove oldest entry if carDump exceeds maximum size
//               carDump.shift();
//             }
//             carDump.push({
//               plateNumber,
//               //direction: direction,
//               deviceId: deviceID
//             });
//           }
//         }
//       }
//     }
//   });

//   //console.log("newFiles", newFiles);
//   console.log("carDump", carDump);
//   watchDirectory(directoryPath);

//   return res.status(200).json({ status: "ok" });
// });



// router.post('/ANotificationInfo/TollgateInfo', async function (req, res, next) {
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);

//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);

//       // Extract plateNumber from the filename
//       const match = filename.match(/__1__(.*?)__1__/);
//       if (match) {
//         const plateNumber = match[1];
        
//         // Check if the plate number is 'unlicensed', ignore the record
//         if (plateNumber !== 'Unlicensed') {
//           const deviceID = "07e3a3d1-a2f6-8ad3-0972-a92f41e2a2f6";
//           const direction = 2;

//           if (!carDump.some(item => item.plateNumber === plateNumber)) {
//             // If plate number doesn't exist in carDump, add it
//             carDump.push({
//               plateNumber,
//               //direction: direction,
//               deviceId: deviceID
//             });
//           }
//         }
//       }
//     }
//   });

//   //console.log("newFiles", newFiles);
//   console.log("carDump", carDump);
//   watchDirectory(directoryPath);

//   return res.status(200).json({ status: "ok" });
// });



// router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);

//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);

//       // Extract plateNumber from the filename
//       const match = filename.match(/__1__(.*?)__1__/);
//       if (match) {
//         const plateNumber = match[1];
        
//         // Check if the plate number is 'unlicensed', ignore the record
//         if (plateNumber !== 'Unlicensed') {
//           const deviceID = "07e3a3d1-a2f6-8ad3-0972-a92f41e2a2f6";
//           const direction = 2;

//           if (!carDump.some(item => item.plateNumber === plateNumber)) {
//             // If plate number doesn't exist in carDump, add it
//             if (carDump.length >= MAX_CAR_DUMP_SIZE) {
//               // Remove oldest entry if carDump exceeds maximum size
//               carDump.shift();
//             }
//             carDump.push({
//               plateNumber,
//               //direction: direction,
//               deviceId: deviceID
//             });
//           }
//         }
//       }
//     }
//   });

//   //console.log("newFiles", newFiles);
//   console.log("carDump", carDump);
//   watchDirectory(directoryPath);

//   return res.status(200).json({ status: "ok" });
// });


// router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);

//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);

//       // Extract plateNumber from the filename
//       const match = filename.match(/__1__(.*?)__1__/);
//       if (match) {
//         const plateNumber = match[1];
        
//         // Check if the plate number is 'unlicensed', ignore the record
//         if (plateNumber !== 'Unlicensed') {
//           const deviceID = "bc2011f1-bea6-bcfc-324a-d91d4cf6bea6";
//           //const direction = 1;

//           if (!carDump.some(item => item.plateNumber === plateNumber)) {
//             // If plate number doesn't exist in carDump, add it
//             carDump.push({
//               plateNumber,
//               // direction: direction,
//               deviceId: deviceID
//             });
//           }
//         }
//       }
//     }
//   });

//   //console.log("newFiles", newFiles);
//   console.log("carDump", carDump);
//   watchDirectory(directoryPath);

//   return res.status(200).json({ status: "ok" });
// });



// Initialize newFiles array to store filenames


// router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const jsonData = req.body;
//   console.log(jsonData);

//   const plateNumber = jsonData.Picture.Plate.PlateNumber;

//   // Check if the plate number is 'unlicensed', ignore the record
//   if (plateNumber === 'unlicensed') {
//     console.log('Plate number is unlicensed. Ignoring the record.');
//     return res.status(200).json({ status: "ignored" });
//   }

//   // Check if the plate number already exists in the data array
//   const existingIndex = carDump.findIndex(item => item.plateNumber === plateNumber);

//   if (existingIndex !== -1) {
//     // If plate number exists, update the existing entry
//     carDump[existingIndex].direction = jsonData.Picture.SnapInfo.Direction;
//     carDump[existingIndex].deviceId = jsonData.Picture.SnapInfo.DeviceID;
//     console.log('Plate number updated:', carDump[existingIndex]);
//   } else {
//     // If plate number doesn't exist, add it to the data array
//     const direction = jsonData.Picture.SnapInfo.Direction;
//     const deviceId = jsonData.Picture.SnapInfo.DeviceID;
//     carDump.push({
//       plateNumber,
//       direction,
//       deviceId
//     });
//     console.log('New plate number added:', carDump[carDump.length - 1]);
//   }

//   // Iterate through existing files in the directory
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);
//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);
//     }
//   });

//   const pattern = /__1__(.*?)__1__/g;
//   const extractedStrings = [];
//   const deviceID = "bc2011f1-bea6-bcfc-324a-d91d4cf6bea6";
//   const _direction = 1;

//   // Execute the regular expression to find all matches
//     newFiles.forEach(filename => {
//     let match;
//     while ((match = pattern.exec(filename)) !== null) {
//       const cleanedName = match[1];
//       if (!extractedStrings.includes(cleanedName)) {
//         extractedStrings.push(cleanedName);
//         if (!carDump.some(item => item.plateNumber === cleanedName)) {
//           // If plate number doesn't exist in carDump and it's not 'unlicensed', add it
//           if (plateNumber !== 'unlicensed') {
//             carDump.push({
//               plateNumber: cleanedName,
//               direction: _direction,
//               deviceId: deviceID
//             });
//           }
//         }
//       }
//     }
//   });

//   console.log("Cleaned Plates", extractedStrings);
//   console.log("newFiles", newFiles);
//   console.log("carDump", carDump);
//   watchDirectory(directoryPath);

//   return res.status(200).json({ status: "ok" });
// });




// router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const jsonData = req.body;
//   console.log(jsonData);

//   const plateNumber = jsonData.Picture.Plate.PlateNumber;
//   const direction = jsonData.Picture.SnapInfo.Direction;
//   const deviceId = jsonData.Picture.SnapInfo.DeviceID;

//   // Check if the plate number already exists in the data array
//   const existingIndex = carDump.findIndex(item => item.plateNumber === plateNumber);

//   if (existingIndex !== -1) {
//     // If plate number exists, update the existing entry
//     carDump[existingIndex] = {
//       plateNumber,
//       direction,
//       deviceId
//     };
//     console.log('Plate number updated:', carDump[existingIndex]);
//   } else {
//     // If plate number doesn't exist, add it to the data array
//     carDump.push({
//       plateNumber,
//       direction,
//       deviceId
//     });
//     console.log('New plate number added:', carDump[carDump.length - 1]);
//   }

//   // Iterate through existing files in the directory
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);
//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);
//     }
//   });

//   const pattern = /__1__(.*?)__1__/g;
//   const extractedStrings = [];
//   const deviceID = "bc2011f1-bea6-bcfc-324a-d91d4cf6bea6";
//   const _direction = 1;

//   // Execute the regular expression to find all matches
//   newFiles.forEach(filename => {
//     let match;
//     while ((match = pattern.exec(filename)) !== null) {
//       const cleanedName = match[1];
//       if (!extractedStrings.includes(cleanedName)) {
//         extractedStrings.push(cleanedName);
//         if(!carDump.includes(cleanedName)){
//           carDump.plateNumber.push(cleanedName);
//           carDump.direction.push(_direction);
//           carDump.plateNumber.push(deviceID);

//         }
//       }
//     }
//   });

//   console.log("Cleaned Plates", extractedStrings);
//   console.log("newFiles", newFiles);
//   console.log("carDump", carDump);
//   watchDirectory(directoryPath);
 

//   return res.status(200).json({ status: "ok" });
// });



// router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const jsonData = req.body;
//   console.log(jsonData);

//   const plateNumber = jsonData.Picture.Plate.PlateNumber;
//   const direction = jsonData.Picture.SnapInfo.Direction;
//   const deviceId = jsonData.Picture.SnapInfo.DeviceID;

//   // Check if the plate number already exists in the data array
//   const existingIndex = carDump.findIndex(item => item.plateNumber === plateNumber);

//   if (existingIndex !== -1) {
//     // If plate number exists, update the existing entry
//     carDump[existingIndex] = {
//       plateNumber,
//       direction,
//       deviceId
//     };
//     console.log('Plate number updated:', carDump[existingIndex]);
//   } else {
//     // If plate number doesn't exist, add it to the data array
//     carDump.push({
//       plateNumber,
//       direction,
//       deviceId
//     });
//     console.log('New plate number added:', carDump[carDump.length - 1]);
//   }

//   // Iterate through existing files in the directory
//   const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
//   const existingFiles = fs.readdirSync(directoryPath);
//   existingFiles.forEach(filename => {
//     if (!newFiles.includes(filename)) {
//       newFiles.push(filename);
//       console.log(`File ${filename} added to newFiles array.`);
//     }
//   });


//   const pattern = /__1__(.*?)__1__/g;
//   const extractedStrings = [];

// // Execute the regular expression to find all matches
//   let match;
//   while ((match = pattern.exec(newFiles)) !== null) {
//     newFiles.push(match[1]);
//   }

// console.log("Uncleaned Plates",newFiles);

// console.log("Cleaned Plates",extractedStrings);
//   // Watch for new files in the directory
//   watchDirectory(directoryPath);
//   console.log("newFiles", newFiles);

//   return res.status(200).json({ status: "ok" });
// });



// router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const jsonData = req.body;
//   console.log(jsonData);

//   const plateNumber = jsonData.Picture.Plate.PlateNumber;
//   const direction = jsonData.Picture.SnapInfo.Direction;
//   const deviceId = jsonData.Picture.SnapInfo.DeviceID;

//   // Check if the plate number already exists in the data array
//   const existingIndex = carDump.findIndex(item => item.plateNumber === plateNumber);

//   if (existingIndex !== -1) {
//     // If plate number exists, update the existing entry
//     carDump[existingIndex] = {
//       plateNumber,
//       direction,
//       deviceId
//     };
//     console.log('Plate number updated:', carDump[existingIndex]);
//   } else {
//     // If plate number doesn't exist, add it to the data array
//     carDump.push({
//       plateNumber,
//       direction,
//       deviceId
//     });
//     console.log('New plate number added:', carDump[carDump.length - 1]);
//   }


// // Check if the picture already exists in the "snaps" directory
//     const pictureFilename = path.join(__dirname, 'snaps', jsonData.Picture.CutoutPic.PicName);
//     if (!fs.existsSync(pictureFilename)) {
//       const pictureContent = jsonData.Picture.CutoutPic.Content;
//       createDirectoryIfNotExists(path.dirname(pictureFilename));
//       writePictureToFile(pictureContent, pictureFilename);
//     } else {
//       console.log('Picture already exists. Ignoring...');
//     }
  

// const directoryPath = path.resolve(__dirname, '../../plates'); // Resolve the absolute path
// watchDirectory(directoryPath);
// console.log("newFiles", newFiles);

//   return res.status(200).json({ status: "ok" });
// });



function createDirectoryIfNotExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log(`Directory ${directoryPath} created.`);
  }
}

// Function to write picture content to file
function writePictureToFile(content, filename) {
  fs.writeFileSync(filename, content, 'base64');
  console.log(`Picture saved to ${filename}`);
}



//router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
//   const jsonData = req.body;
//   console.log(jsonData);


//   const plateNumber = jsonData.Picture.Plate.PlateNumber;
//   const direction = jsonData.Picture.SnapInfo.Direction;
//   const deviceId = jsonData.Picture.SnapInfo.DeviceID;
//   const data = {
//     plateNumber,
//     direction,
//     deviceId
//   };
//   console.log('Data:', data);
//   //console.log("req data", data);
//   // const plateNumber = data.Picture.Plate.PlateNumber;
//   // const plateColor = data.Picture.Plate.PlateColor;
//   // const deviceID = data.Picture.SnapInfo.DeviceID;
//   // const direction = data.Picture.SnapInfo.Direction;

//   // if (plateNumber !== lastPlateNumber) {
//   //   // Store data in carDump array

//   //   carDump.push({
//   //     'plateNumber': plateNumber,
//   //     'plateColor': plateColor,
//   //     'deviceID': deviceID,
//   //     'direction': direction
//   //   });

//   //   ///console.log("sawa");

//   //   // Update lastPlateNumber
//   //   lastPlateNumber = plateNumber;
//   // }

//   // // Logging plate number and color to the console
//   // console.log("Plate Number:", plateNumber);
//   // console.log("Plate Color:", plateColor);
//   // console.log("Device ID:", deviceID);
//   // console.log("Direction:", direction);

//   // console.log("carDump", carDump);

//   return res.status(200).json({ status: "ok" });
// });

// router.post('/ANotificationInfo/TollgateInfo', async function (req, res, next) {
//   const data = req.body;
//   //console.log("req data", data);
//   const plateNumber = data.Picture.Plate.PlateNumber;
//   const plateColor = data.Picture.Plate.PlateColor;
//   const deviceID = data.Picture.SnapInfo.DeviceID;
//   const direction = data.Picture.SnapInfo.Direction;

//   if (plateNumber !== lastPlateNumber) {
//     // Store data in carDump array

//     carDump.push({
//       'plateNumber': plateNumber,
//       'plateColor': plateColor,
//       'deviceID': deviceID,
//       'direction': direction
//     });

//     ///console.log("sawa");

//     // Update lastPlateNumber
//     lastPlateNumber = plateNumber;
//   }

//   // Logging plate number and color to the console
//   console.log("Plate Number:", plateNumber);
//   console.log("Plate Color:", plateColor);
//   console.log("Device ID:", deviceID);
//   console.log("Direction:", direction);

//   console.log("carDump", carDump);

//   return res.status(200).json({ status: "ok" });
// });



// router.post('/NotificationInfo/TollgateInfo', function(req, res, next) {
//   const data = req.body;
//   //console.log("req data", data);
//   const plateNumber = data.Picture.Plate.PlateNumber;
//   const plateColor = data.Picture.Plate.PlateColor;
//   const deviceID = data.Picture.SnapInfo.DeviceID;
//   const direction = data.Picture.SnapInfo.Direction;


//   if (plateNumber !== lastPlateNumber) {
//     // Store data in Redis
//     // client.hmset('plate_info', {
//     //   'plateNumber': plateNumber,
//     //   'plateColor': plateColor,
//     //   'deviceID': deviceID,
//     //   'direction': direction
//     // });
//     carDump = [];

//     carDump.push{ 'plate_info',{
//       'plateNumber': plateNumber,
//       'plateColor': plateColor,
//       'deviceID': deviceID,
//       'direction': direction
//      }
//     }

//     console.log("sawa");

//     // Update lastPlateNumber
//     lastPlateNumber = plateNumber;  
// }

// // Logging plate number and color to the console
// console.log("Plate Number:", plateNumber);
// console.log("Plate Color:", plateColor);
// console.log("Device ID:", deviceID);
// console.log("Direction:", direction);

// return res.status(200).json({status: "ok"});

// });

module.exports = router;