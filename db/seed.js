// One-off seed script: populates the projects table from
// "LA Homes Cheshire Projects.docx" (portfolio + heritage projects), wiring up
// the real property photos that were embedded in that document.
//
// Run with: node db/seed.js
// Safe to re-run — it skips any project whose slug already exists.

const slugify = require("slugify");
const db = require("./index");

const SEED_IMAGE_DIR = "/uploads/images/seed";

const portfolioProjects = [
  {
    title: "Fairfield Road Development",
    location: "Land Adjacent to 11 Fairfield Road, Cadishead, M44 5HX",
    status: "completed",
    summary: "Development of three new five-bedroom dwellings.",
    description: "Development of 3 new dwellings, which comprises 5 bedrooms each. Project completed in 2022.",
    image: "fairfield-road.jpeg"
  },
  {
    title: "Windsor Avenue Scheme",
    location: "Land Adjacent to Windsor Avenue, Irlam, M44 6HP",
    status: "upcoming",
    summary: "Planning consent granted for four 4-bed detached houses with integral garages.",
    description: "Planning consent granted to develop 4 x 4 bed detached houses with integral garage, landscaping and a good size garden.",
    image: "windsor-avenue.jpg"
  },
  {
    title: "Tennyson Close Bungalow",
    location: "Land at 6 Tennyson Close, Macclesfield, Cheshire",
    status: "completed",
    summary: "A three-bedroom detached bungalow, built from scratch.",
    description: "A 3 bedroom detached bungalow built from scratch.",
    image: "tennyson-close.jpeg"
  },
  {
    title: "Edinburgh Road Bungalow",
    location: "Land at 76a Edinburgh Road, Congleton, Cheshire",
    status: "completed",
    summary: "A two-bedroom detached bungalow, built from scratch.",
    description: "A 2 bedroom detached bungalow built from scratch.",
    image: "edinburgh-road.jpg"
  },
  {
    title: "Knutsford Road House",
    location: "Land at 1 Knutsford Road, Chelford, Cheshire",
    status: "completed",
    summary: "A four-bedroom detached three-storey modern house.",
    description: "A 4 bedroom detached 3 storey modern house build.",
    image: "knutsford-road.png"
  },
  {
    title: "Roundhey House",
    location: "Land at 70 Roundhey, Heald Green, Stockport",
    status: "completed",
    summary: "A two-bedroom detached house, built from scratch.",
    description: "A 2 bedroom detached house build from scratch.",
    image: "roundhey.png"
  },
  {
    title: "Belfry Close Extension",
    location: "7 Belfry Close, Wilmslow, Cheshire",
    status: "completed",
    summary: "A large house extension delivered at a Wilmslow home.",
    description: "A large house extension done at a Wilmslow house in Cheshire.",
    image: "belfry-close.png"
  },
  {
    title: "Cheadle Wood",
    location: "21 Cheadle Wood, Cheadle Hulme, SK8 6SS",
    status: "completed",
    summary: "A 2,000 sq ft build with landscaped garden, completed on time in 2017.",
    description: "Project completed in 2017, on time. This project was a 2,000 sq ft build covering the area, with a landscaped garden. This project was worth more than £300,000.",
    image: "cheadle-wood.png"
  },
  {
    title: "Longcroft Lane Farmhouse",
    location: "43 Longcroft Lane, Cheadle Hulme, SK8 6SD",
    status: "completed",
    summary: "Renovation of a five-bedroom detached farmhouse of over 4,000 sq ft.",
    description: "Renovation project: 5 bedroom detached farm house, completed in 2014. This project was more than a 4,000 sq ft build, covering an area with 1 acre of landscaped garden. This project was worth more than a quarter of a million pounds.",
    image: null
  }
];

const heritageProjects = [
  { title: "1–1A Lawton Avenue, Moston", location: "Moston, Manchester", note: "Renovated the whole house to the highest standard." },
  { title: "23 Ringley Street, Moston", location: "Moston, Manchester", note: "Renovated the whole house to the highest standard." },
  { title: "3 Pym Street, Moston", location: "Moston, Manchester", note: "Renovated the whole house to the highest standard." },
  { title: "8 Dorset Avenue, Cheadle Hulme", location: "Cheadle Hulme, SK8 5QP", note: "Renovated the whole house to the highest standard." },
  { title: "43 Longcroft Lane, Cheadle Hulme", location: "Cheadle Hulme, SK8 6SD", note: "Renovated the whole house to the highest standard." },
  { title: "118 Cambridge Street, Stalybridge", location: "Stalybridge, SK15", note: "Renovated the whole house to the highest standard." },
  { title: "35 Booth Street, Ashton-under-Lyne", location: "Ashton-under-Lyne, OL6 7LB", note: "Converted the whole house to three high-standard flats." },
  { title: "81 Goodman Street, Moston", location: "Moston, M9 4FD", note: "Converted the whole house to three high-standard flats." },
  { title: "38 Agnes Street, Levenshulme", location: "Levenshulme, M19", note: "Converted the whole house to four high-standard flats." },
  { title: "1 Grasmere Street, Longsight", location: "Longsight, M12 5TD", note: "Renovated the whole house to the highest standard." },
  { title: "1327 Ashton Road, Openshaw", location: "Openshaw, M11 1NX", note: "Renovated ground floor shop to a takeaway, and renovated the first floor flat to the highest standard." },
  { title: "284 Barlow Road, Manchester", location: "Manchester, M12", note: "Renovated the whole house to the highest standard." }
];

function slugFor(table, title) {
  const root = slugify(title, { lower: true, strict: true }) || "project";
  let candidate = root;
  let suffix = 2;
  while (db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(candidate)) {
    candidate = `${root}-${suffix++}`;
  }
  return candidate;
}

function insertProject({ title, location, status, category, summary, description, coverImage }) {
  const existing = db.prepare("SELECT id FROM projects WHERE title = ?").get(title);
  if (existing) {
    console.log(`Skipping "${title}" — already exists.`);
    return existing.id;
  }

  const slug = slugFor("projects", title);
  const info = db
    .prepare(
      `INSERT INTO projects (slug, title, location, summary, description, status, category, cover_image, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(slug, title, location, summary, description, status, category, coverImage);
  console.log(`Created "${title}" (${category}).`);
  return info.lastInsertRowid;
}

function insertCoverAsMedia(projectId, coverImagePath) {
  if (!coverImagePath) return;
  const existing = db
    .prepare("SELECT id FROM project_media WHERE project_id = ? AND file_path = ?")
    .get(projectId, coverImagePath);
  if (existing) return;
  db.prepare(
    "INSERT INTO project_media (project_id, type, file_path, sort_order) VALUES (?, 'image', ?, 0)"
  ).run(projectId, coverImagePath);
}

function run() {
  portfolioProjects.forEach(project => {
    const coverImage = project.image ? `${SEED_IMAGE_DIR}/${project.image}` : null;
    const id = insertProject({
      title: project.title,
      location: project.location,
      status: project.status,
      category: "portfolio",
      summary: project.summary,
      description: project.description,
      coverImage
    });
    insertCoverAsMedia(id, coverImage);
  });

  heritageProjects.forEach(project => {
    insertProject({
      title: project.title,
      location: project.location,
      status: "completed",
      category: "heritage",
      summary: project.note,
      description: project.note,
      coverImage: null
    });
  });

  console.log("Seed complete.");
}

run();
