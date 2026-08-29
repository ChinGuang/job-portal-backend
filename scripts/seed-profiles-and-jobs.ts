/**
 * Seed job-seeker profiles, employer profiles, and job listings into the local
 * Postgres DB for development / demos.
 *
 * Operates on users that ALREADY EXIST in the local `users` table (the ones
 * mirrored from Supabase auth via the webhook, or lazily provisioned on first
 * sign-in). Profiles/jobs are keyed on users.id — the local PK — not on the
 * Supabase auth id, so this runs entirely against Postgres with no app or JWTs.
 *
 * It picks users that don't yet have a profile:
 *   - the first  5  ->  a JobSeekerProfile
 *   - the next   5  ->  an EmployerProfile, each with 5 PUBLISHED job listings
 *                       (25 jobs total)
 *
 * Re-running is safe: users that already carry a profile are skipped, so a
 * second run only fills in newly added users.
 *
 * Run: pnpm seed:profiles   (loads .env.local; needs the POSTGRES_* vars).
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/data-source';
import {
  Job,
  JobStatus,
  JobType,
} from '../src/modules/jobs/entities/job.entity';
import {
  EmployerProfile,
  JobSeekerProfile,
} from '../src/modules/profiles/entities/profile.entity';
import { User } from '../src/modules/users/entities/user.entity';

const JOB_SEEKER_COUNT = 5;
const EMPLOYER_COUNT = 5;
const JOBS_PER_EMPLOYER = 5;

const ok = (msg: string): void => console.log(`✅ ${msg}`);

function fail(msg: string, extra?: unknown): never {
  console.error(`❌ ${msg}`, extra ?? '');
  process.exit(1);
}

// A pool of sample content, indexed per employer so each of the 5 employers
// gets a distinct company and its own 5 distinct listings.
const COMPANIES = [
  {
    companyName: 'Northwind Labs',
    industry: 'Software',
    companySize: '11-50',
    address: 'Kuala Lumpur, MY',
    jobs: [
      {
        title: 'Backend Engineer',
        type: JobType.FULL_TIME,
        location: 'Kuala Lumpur, MY',
        min: 6000,
        max: 9000,
      },
      {
        title: 'Frontend Engineer',
        type: JobType.FULL_TIME,
        location: 'Remote',
        min: 5500,
        max: 8500,
      },
      {
        title: 'DevOps Engineer',
        type: JobType.CONTRACT,
        location: 'Kuala Lumpur, MY',
        min: 7000,
        max: 11000,
      },
      {
        title: 'QA Analyst',
        type: JobType.PART_TIME,
        location: 'Penang, MY',
        min: 3000,
        max: 4500,
      },
      {
        title: 'Software Intern',
        type: JobType.INTERNSHIP,
        location: 'Kuala Lumpur, MY',
        min: 1500,
        max: 2000,
      },
    ],
  },
  {
    companyName: 'Cirrus Analytics',
    industry: 'Data & AI',
    companySize: '51-200',
    address: 'Singapore, SG',
    jobs: [
      {
        title: 'Data Engineer',
        type: JobType.FULL_TIME,
        location: 'Singapore, SG',
        min: 8000,
        max: 12000,
      },
      {
        title: 'Machine Learning Engineer',
        type: JobType.FULL_TIME,
        location: 'Remote',
        min: 9000,
        max: 14000,
      },
      {
        title: 'Analytics Engineer',
        type: JobType.CONTRACT,
        location: 'Singapore, SG',
        min: 7500,
        max: 11000,
      },
      {
        title: 'BI Analyst',
        type: JobType.FULL_TIME,
        location: 'Singapore, SG',
        min: 6000,
        max: 9000,
      },
      {
        title: 'Data Science Intern',
        type: JobType.INTERNSHIP,
        location: 'Singapore, SG',
        min: 2500,
        max: 3500,
      },
    ],
  },
  {
    companyName: 'Harborview Retail',
    industry: 'E-commerce',
    companySize: '201-500',
    address: 'Johor Bahru, MY',
    jobs: [
      {
        title: 'Full-Stack Developer',
        type: JobType.FULL_TIME,
        location: 'Johor Bahru, MY',
        min: 6500,
        max: 10000,
      },
      {
        title: 'Mobile Engineer (React Native)',
        type: JobType.FULL_TIME,
        location: 'Remote',
        min: 7000,
        max: 10500,
      },
      {
        title: 'Product Designer',
        type: JobType.FULL_TIME,
        location: 'Johor Bahru, MY',
        min: 5500,
        max: 8000,
      },
      {
        title: 'Customer Support Lead',
        type: JobType.PART_TIME,
        location: 'Johor Bahru, MY',
        min: 3500,
        max: 5000,
      },
      {
        title: 'UX Research Intern',
        type: JobType.INTERNSHIP,
        location: 'Johor Bahru, MY',
        min: 1800,
        max: 2500,
      },
    ],
  },
  {
    companyName: 'Summit Fintech',
    industry: 'Financial Services',
    companySize: '11-50',
    address: 'Kuala Lumpur, MY',
    jobs: [
      {
        title: 'Platform Engineer',
        type: JobType.FULL_TIME,
        location: 'Kuala Lumpur, MY',
        min: 8000,
        max: 13000,
      },
      {
        title: 'Security Engineer',
        type: JobType.FULL_TIME,
        location: 'Remote',
        min: 9000,
        max: 14000,
      },
      {
        title: 'Payments Integration Engineer',
        type: JobType.CONTRACT,
        location: 'Kuala Lumpur, MY',
        min: 8500,
        max: 12000,
      },
      {
        title: 'Compliance Analyst',
        type: JobType.FULL_TIME,
        location: 'Kuala Lumpur, MY',
        min: 5000,
        max: 7500,
      },
      {
        title: 'Backend Intern',
        type: JobType.INTERNSHIP,
        location: 'Kuala Lumpur, MY',
        min: 2000,
        max: 3000,
      },
    ],
  },
  {
    companyName: 'Evergreen Health',
    industry: 'HealthTech',
    companySize: '51-200',
    address: 'Petaling Jaya, MY',
    jobs: [
      {
        title: 'Senior Backend Engineer',
        type: JobType.FULL_TIME,
        location: 'Petaling Jaya, MY',
        min: 9000,
        max: 13500,
      },
      {
        title: 'Cloud Infrastructure Engineer',
        type: JobType.FULL_TIME,
        location: 'Remote',
        min: 8500,
        max: 12500,
      },
      {
        title: 'Integration Engineer (HL7/FHIR)',
        type: JobType.CONTRACT,
        location: 'Petaling Jaya, MY',
        min: 8000,
        max: 11500,
      },
      {
        title: 'Technical Writer',
        type: JobType.PART_TIME,
        location: 'Remote',
        min: 3000,
        max: 4500,
      },
      {
        title: 'Engineering Intern',
        type: JobType.INTERNSHIP,
        location: 'Petaling Jaya, MY',
        min: 1800,
        max: 2600,
      },
    ],
  },
] as const;

// Sample job-seeker content, one entry per seeded seeker.
const SEEKERS = [
  {
    name: 'Alex Tan',
    headline: 'Backend Developer',
    skills: ['Node.js', 'NestJS', 'PostgreSQL'],
    years: 3,
  },
  {
    name: 'Bianca Lee',
    headline: 'Frontend Developer',
    skills: ['React', 'TypeScript', 'CSS'],
    years: 4,
  },
  {
    name: 'Chandran Raj',
    headline: 'Data Analyst',
    skills: ['SQL', 'Python', 'Power BI'],
    years: 2,
  },
  {
    name: 'Divya Nair',
    headline: 'Full-Stack Engineer',
    skills: ['Vue', 'Node.js', 'AWS'],
    years: 5,
  },
  {
    name: 'Ethan Wong',
    headline: 'DevOps Engineer',
    skills: ['Docker', 'Kubernetes', 'Terraform'],
    years: 6,
  },
] as const;

async function main(): Promise<void> {
  const dataSource = new DataSource({
    ...dataSourceOptions,
    // These scripts run from source, not the compiled dist/.
    entities: ['src/**/*.entity.ts'],
  });

  await dataSource.initialize();
  // ok(`connected to ${dataSourceOptions.database}@${dataSourceOptions.host}`);

  try {
    await dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const seekerRepo = manager.getRepository(JobSeekerProfile);
      const employerRepo = manager.getRepository(EmployerProfile);
      const jobRepo = manager.getRepository(Job);

      // Users with no profile of either kind, oldest first, so results are
      // stable across runs.
      const candidates = await userRepo
        .createQueryBuilder('u')
        .leftJoin(JobSeekerProfile, 'jsp', 'jsp.userId = u.id')
        .leftJoin(EmployerProfile, 'ep', 'ep.userId = u.id')
        .where('u.deletedAt IS NULL')
        .andWhere('jsp.id IS NULL')
        .andWhere('ep.id IS NULL')
        .orderBy('u.createdAt', 'ASC')
        .getMany();

      const needed = JOB_SEEKER_COUNT + EMPLOYER_COUNT;
      if (candidates.length < needed) {
        fail(
          `need ${needed} profile-less users but found ${candidates.length}. ` +
            'Make sure your mock users are mirrored into the local `users` table ' +
            'first (run the app so the Supabase webhook fires, or have them sign in).',
        );
      }

      const seekerUsers = candidates.slice(0, JOB_SEEKER_COUNT);
      const employerUsers = candidates.slice(
        JOB_SEEKER_COUNT,
        JOB_SEEKER_COUNT + EMPLOYER_COUNT,
      );

      // --- job-seeker profiles ---
      for (const [i, user] of seekerUsers.entries()) {
        const s = SEEKERS[i];
        const profile = seekerRepo.create({
          userId: user.id,
          name: s.name,
          headline: s.headline,
          bio: `${s.headline} with ${s.years} years of experience.`,
          skills: [...s.skills],
          yearsOfExperience: s.years,
        });
        await seekerRepo.save(profile);
        ok(`job-seeker profile: ${s.name} <- ${user.email}`);
      }

      // --- employer profiles + their listings ---
      for (const [i, user] of employerUsers.entries()) {
        const c = COMPANIES[i];
        const employer = employerRepo.create({
          userId: user.id,
          companyName: c.companyName,
          industry: c.industry,
          companySize: c.companySize,
          address: c.address,
          websiteUrl: `https://${c.companyName.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`,
          description: `${c.companyName} — a ${c.industry} company.`,
        });
        await employerRepo.save(employer);
        ok(`employer profile: ${c.companyName} <- ${user.email}`);

        const jobs = c.jobs.slice(0, JOBS_PER_EMPLOYER).map((j) =>
          jobRepo.create({
            employerProfileId: employer.id,
            title: j.title,
            description: `${c.companyName} is hiring a ${j.title}. Join our ${c.industry} team.`,
            requirements: [
              `Experience relevant to ${j.title}`,
              'Team player',
              'Good communication',
            ],
            location: j.location,
            jobType: j.type,
            salaryMin: j.min,
            salaryMax: j.max,
            currency: 'MYR',
            // Publish so the listings are visible to job seekers immediately.
            status: JobStatus.PUBLISHED,
          }),
        );
        await jobRepo.save(jobs);
        ok(`  ${jobs.length} listings for ${c.companyName}`);
      }
    });

    console.log(
      `\nDone: ${JOB_SEEKER_COUNT} job-seeker profiles, ${EMPLOYER_COUNT} employer ` +
        `profiles, ${EMPLOYER_COUNT * JOBS_PER_EMPLOYER} job listings.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => fail('unexpected error', err));
