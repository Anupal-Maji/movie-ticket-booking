function validateYoutubeUrl(url) {

  if (!url) {
    return null;
  }  

  const cleanUrl = url.trim();

  const youtubeEmbedPattern = /^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{6,15}$/;

  const isValid = youtubeEmbedPattern.test(cleanUrl);

  if (isValid) {
    return cleanUrl;
  } else {
    return null;
  }  
}

module.exports = { validateYoutubeUrl };