const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const {BlogPost} = require('../models');
const {runServer, app, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogPostData() {
  console.info('seeding posts post data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogPostData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

// used to generate data to put in db
function generateBlogPostData() {
  return {
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraph(),
    author: {firstName: faker.name.firstName(), lastName: faker.name.lastName()}

  }
}



// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure  ata from one test does not stick
// around for next one
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('BlogPost API resource', function() {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedRestaurantData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogPostData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  })

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing posts posts', function() {
      // strategy:
      //    1. get back all restaurants returned by by GET request to `/restaurants`
      //    2. prove res has right status, data type
      //    3. prove the number of restaurants we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          // so subsequent .then blocks can access resp obj.
          res = _res;
          res.should.have.status(200);
          // otherwise our db seeding didn't work
          res.body.should.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          res.body.should.have.length.of(count);
        });
    });


    it('should return posts with right fields', function() {
      // Strategy: Get back all restaurants, and ensure they have expected keys

      let resBlogPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(posts) {
            should.be.an('object');
            should.include.keys(
              'id', 'title', 'content', 'author');
          });
          resBlogPost = res.body[0];
          return BlogPost.findById(resBlogPost.id);
        })
        .then(function(posts) {
          //removed post.from () may need to undo
          resBlogPost.id.should.equal(id);
          resBlogPost.title.should.equal(title);
          resBlogPost.content.should.equal(content);
          resBlogPost.author.firstName.should.equal(author.firstName);
          resBlogPost.author.lastName.should.equal(author.lastName);
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the posts we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new posts', function() {

      const newBlogPost = generateBlogPostData();

      return chai.request(app)
        .post('/posts')
        .send(newBlogPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'content', 'author');
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;
          res.body.title.should.equal(newBlogPost.title);
          res.body.content.should.equal(newBlogPost.content);
          res.body.author.firstName.should.equal(newBlogPost.author.firstName);
          res.body.author.lastName.should.equal(newBlogPost.author.lastName);
          return BlogPost.findById(res.body.id);
        })
        .then(function(posts) {
          posts.title.should.equal(newBlogPost.title);
          posts.content.should.equal(newBlogPost.content);
          posts.author.firstName.should.equal(newBlogPost.author.firstName);
          posts.author.lastName.should.equal(newBlogPost.author.lastName);

        });
    });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing posts from db
    //  2. Make a PUT request to update that posts
    //  3. Prove posts returned by request contains data we sent
    //  4. Prove posts in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        content: 'futuristic fusion'
      };

      return BlogPost
        .findOne()
        .exec()
        .then(function(posts) {
          updateData.id = posts.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${posts.id}`)
            .send(updateData);
        })
        .then(function(res) {
          res.should.have.status(201);

          return BlogPost.findById(updateData.id).exec();
        })
        .then(function(posts) {
          posts.title.should.equal(updateData.title);
          posts.content.should.equal(updateData.content);
        });
      });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a posts
    //  2. make a DELETE request for that posts's id
    //  3. assert that response has right status code
    //  4. prove that posts with the id doesn't exist in db anymore
    it('delete a posts by id', function() {

      let posts;

      return BlogPost
        .findOne()
        .exec()
        .then(function(_blog) {
          posts = _blog;
          return chai.request(app).delete(`/posts/${posts.id}`);
        })
        .then(function(res) {
          res.should.have.status(201);
          return BlogPost.findById(posts.id).exec();
        })
        .then(function(_blog) {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_blog.should.be.null` would raise
          // an error. `should.be.null(_blog)` is how we can
          // make assertions about a null value.
          should.not.exist(_blog);
        });
    });
  });
});
