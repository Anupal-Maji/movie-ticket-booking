const { sendConfirmationEmail } = require('./mailer');
const { logEmailFailure } = require('./logger');

const queue = [];
let isProcessing = false;

function addToEmailQueue(bookingDetails) {
  queue.push(bookingDetails);
  console.log(`Email job added to queue. Queue size: ${queue.length}`);
  processQueue();  
}

async function processQueue() {
  if (isProcessing) return;
  if (queue.length === 0) return;

  isProcessing = true;
  const bookingDetails = queue.shift();
  console.log(`Processing email for: ${bookingDetails.user_email}`);

  try {
    await sendEmailWithRetry(bookingDetails);
    console.log(`Email sent successfully to: ${bookingDetails.user_email}`);
  } catch (error) {
    console.error(`All retries failed for: ${bookingDetails.user_email}`);
    logEmailFailure(bookingDetails, error.message);
}

  isProcessing = false;

  if (queue.length > 0) {
    processQueue();
  }    
}

async function sendEmailWithRetry(bookingDetails) {

  const MAX_ATTEMPTS = 3;
  const WAIT_TIMES = [30000, 60000];

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

    try {
      console.log(`Attempt ${attempt} of ${MAX_ATTEMPTS}: Sending email to ${bookingDetails.user_email}...`);

      await sendConfirmationEmail(bookingDetails);

      console.log(`Email sent successfully on attempt ${attempt}!`);
      return;

    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed. Reason: ${error.message}`);

      if (attempt < MAX_ATTEMPTS) {
        const waitTime = WAIT_TIMES[attempt - 1];
        const waitSeconds = waitTime / 1000;
        console.log(`Waiting ${waitSeconds} seconds before next attempt...`);
        await sleep(waitTime);
      }
    }  

    }

    console.error(`All ${MAX_ATTEMPTS} attempts failed for ${bookingDetails.user_email}`);
    throw lastError;
  }

  function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
  }

module.exports = { addToEmailQueue };