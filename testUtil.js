const { validateYoutubeUrl } = require('./util');

console.log(validateYoutubeUrl('https://www.youtube.com/embed/YoHD9XEInc0'));

console.log(validateYoutubeUrl('https://evil.com/hack'));

console.log(validateYoutubeUrl('javascript:alert("hacked")'));

console.log(validateYoutubeUrl(null));

console.log(validateYoutubeUrl('https://www.youtube.com/watch?v=YoHD9XEInc0'));
