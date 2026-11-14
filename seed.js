const { faker } = require('@faker-js/faker');
const db = require('./db');

const genres = [
    'Action',
    'Comedy',
    'Drama',
    'Horror',
    'Romance',
    'Thriller',
    'Sci-Fi',
    'Animation',
    'Documentary',
    'Fantasy'
];

const languages = [
    'Hindi',
    'English',
    'Bengali',
    'Tamil',
    'Telugu',
    'Malayalam',
    'Marathi',
    'Kannada'
];

function generateMovie() {
    return [
        faker.lorem.words(3),
        faker.helpers.arrayElement(genres),
        faker.helpers.arrayElement(languages),
        faker.number.float({
            min: 1.0,
            max: 10.0,
            fractionDigits: 1
        }),
        faker.date.between({
            from: '2000-01-01',
            to: '2024-12-31'
        }).toISOString().split('T')[0]
    ]; 
}      
 
function seedDatabase(){

    console.log('Starting to fill the database with movies...');

    const movies = [];

    for(let i = 0; i < 5000; i++) {
        movies.push(generateMovie());
    }

    console.log('Generated 5000 movies! Now inserting into the database...');
 
const query = `
  INSERT INTO movies 
  (title, genre, language, rating, release_date) 
  VALUES ?    
`;

db.query(query, [movies], (err, result) => {
    if (err) {
      console.log('Error inserting movies:', err.message);
    } else {
      console.log(`Successfully added ${result.affectedRows} movies!`);
      console.log('Database is ready!');
    }
    
    db.end();
});
}

seedDatabase();
