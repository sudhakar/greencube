/**
 * GreenCube cube definitions — expanded HR analytics schema.
 *
 * Tables:
 *   employees          (id, name, email, active, sex, nationality, band, birth_date, start_date,
 *                       last_working_date, manager_id, department_id, office_id, salary,
 *                       city, region, country, latitude, longitude, created_at)
 *   departments        (id, name, budget)
 *   offices            (id, name, city, region, country, latitude, longitude, created_at)
 *   productivity       (id, employee_id, department_id, date, lines_of_code, pull_requests,
 *                       live_deployments, days_off, happiness_index, created_at)
 *   performance_reviews(id, employee_id, reviewer_id, review_date, period_start, period_end,
 *                       rating, created_at)
 *   pr_events          (id, pr_number, event_type, employee_id, timestamp, created_at)
 *   teams              (id, name, description, department_id, created_at)
 *   employee_teams     (id, employee_id, team_id, role, joined_at)
 *   skills             (id, name, category, created_at)
 *   employee_skills    (id, employee_id, skill_id, proficiency_level, since_date)
 *
 * Feature coverage:
 *   Measures:  count, countDistinct, countDistinctApprox, sum, avg, min, max,
 *              stddev, stddevSamp, variance, varianceSamp, median, p95, p99,
 *              calculated, scalar subquery (via max)
 *   Windows:   rank, denseRank, rowNumber, lag, lead, firstValue, lastValue,
 *              movingAvg, movingSum, ntile
 *   Joins:     belongsTo, hasMany (→ CTE pre-aggregation)
 *   Filters:   measure-level FILTER WHERE, all operators
 *   Misc:      time dimensions, computed dimensions, ungrouped, AND/OR
 */

import { type Cube, defineCube } from './lib/GreenCube.ts'

// =============================================================================
// Employees
// =============================================================================

export const employeesCube = defineCube('Employees', {
  sql: 'analytics.employees e',
  pk: ['id'],
  sampleQueries: [
    'employee count by band and country, top 5 bands',
    'average, median, min, max, stddev, variance, p95 and p99 salary by nationality',
    'employees without last working date, count by department',
  ],
  dimensions: {
    id: { sql: 'e.id', type: 'number' },
    name: { sql: 'e.name', type: 'string', title: 'Name' },
    email: { sql: 'e.email', type: 'string' },
    isActive: { sql: 'e.active', type: 'boolean' },
    sex: { sql: 'e.sex', type: 'string' },
    nationality: { sql: 'e.nationality', type: 'string' },
    band: { sql: 'e.band', type: 'string' },
    departmentId: { sql: 'e.department_id', type: 'number' },
    officeId: { sql: 'e.office_id', type: 'number' },
    managerId: { sql: 'e.manager_id', type: 'number' },
    age: { sql: "DATEDIFF('year', e.birth_date, CURRENT_DATE)", type: 'number', title: 'Age' },
    city: { sql: 'e.city', type: 'string' },
    region: { sql: 'e.region', type: 'string' },
    country: { sql: 'e.country', type: 'string' },
    latitude: { sql: 'e.latitude', type: 'number' },
    longitude: { sql: 'e.longitude', type: 'number' },
    startDate: { sql: 'e.start_date', type: 'time' },
    lastWorkingDate: { sql: 'e.last_working_date', type: 'time' },
    createdAt: { sql: 'e.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'e.id', type: 'countDistinct' },
    activeCount: {
      sql: 'e.id',
      type: 'countDistinct',
      filters: [() => 'e.active = TRUE'],
    },
    totalSalary: { sql: 'e.salary', type: 'sum' },
    avgSalary: { sql: 'e.salary', type: 'avg' },
    minSalary: { sql: 'e.salary', type: 'min' },
    maxSalary: { sql: 'e.salary', type: 'max' },
    stddevSalary: { sql: 'e.salary', type: 'stddev' },
    varnceSalary: { sql: 'e.salary', type: 'variance' },
    medianSalary: { sql: 'e.salary', type: 'median' },
    p95Salary: { sql: 'e.salary', type: 'p95' },
    p99Salary: { sql: 'e.salary', type: 'p99' },
    reporteesCount: {
      sql: '(SELECT COUNT(*) FROM analytics.employees sub WHERE sub.manager_id = e.id)',
      type: 'max',
    },
    activePercentage: {
      type: 'calculated',
      calculatedSql: '({Employees.activeCount} / NULLIF({Employees.count}, 0)) * 100',
    },
    avgSalaryPerActive: {
      type: 'calculated',
      calculatedSql: '{Employees.totalSalary} / NULLIF({Employees.activeCount}, 0)',
    },
  },
  joins: {
    Departments: {
      targetCube: 'Departments',
      keys: { source: 'e.department_id', target: 'd.id' },
      relationship: 'belongsTo',
    },
    Offices: {
      targetCube: 'Offices',
      keys: { source: 'e.office_id', target: 'o.id' },
      relationship: 'belongsTo',
    },
    Productivity: {
      targetCube: 'Productivity',
      keys: { source: 'e.id', target: 'p.employee_id' },
      relationship: 'hasMany',
    },
    PerformanceReviews: {
      targetCube: 'PerformanceReviews',
      keys: { source: 'e.id', target: 'pr.employee_id' },
      relationship: 'hasMany',
    },
    PREvents: {
      targetCube: 'PREvents',
      keys: { source: 'e.id', target: 'pre.employee_id' },
      relationship: 'hasMany',
    },
    EmployeeSkills: {
      targetCube: 'EmployeeSkills',
      keys: { source: 'e.id', target: 'es.employee_id' },
      relationship: 'hasMany',
    },
    EmployeeTeams: {
      targetCube: 'EmployeeTeams',
      keys: { source: 'e.id', target: 'et.employee_id' },
      relationship: 'hasMany',
    },
  },
})

// =============================================================================
// Departments
// =============================================================================

export const departmentsCube = defineCube('Departments', {
  sql: 'analytics.departments d',
  pk: ['id'],
  sampleQueries: [
    'total departments, average budget and median budget',
    'top 5 departments by total budget and average budget',
    'departments with highest average budget, top 10',
  ],
  dimensions: {
    id: { sql: 'd.id', type: 'number' },
    name: { sql: 'd.name', type: 'string' },
  },
  measures: {
    count: { sql: 'd.id', type: 'countDistinct' },
    totalBudget: { sql: 'd.budget', type: 'sum' },
    avgBudget: { sql: 'd.budget', type: 'avg' },
    stddevBudget: { sql: 'd.budget', type: 'stddev' },
    medianBudget: { sql: 'd.budget', type: 'median' },
    budgetPerDepartment: {
      type: 'calculated',
      calculatedSql: '{Departments.totalBudget} / NULLIF({Departments.count}, 0)',
    },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'd.id', target: 'e.department_id' },
      relationship: 'hasMany',
    },
    Productivity: {
      targetCube: 'Productivity',
      keys: { source: 'd.id', target: 'p.department_id' },
      relationship: 'hasMany',
    },
    Teams: {
      targetCube: 'Teams',
      keys: { source: 'd.id', target: 't.department_id' },
      relationship: 'hasMany',
    },
  },
})

// =============================================================================
// Offices
// =============================================================================

export const officesCube = defineCube('Offices', {
  sql: 'analytics.offices o',
  pk: ['id'],
  sampleQueries: [
    'office count by country and region, top 10',
    'total offices and average employee count per office by country',
  ],
  dimensions: {
    id: { sql: 'o.id', type: 'number' },
    name: { sql: 'o.name', type: 'string' },
    city: { sql: 'o.city', type: 'string' },
    region: { sql: 'o.region', type: 'string' },
    country: { sql: 'o.country', type: 'string' },
    latitude: { sql: 'o.latitude', type: 'number' },
    longitude: { sql: 'o.longitude', type: 'number' },
    createdAt: { sql: 'o.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'o.id', type: 'countDistinct' },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'o.id', target: 'e.office_id' },
      relationship: 'hasMany',
    },
  },
})

// =============================================================================
// Productivity
// =============================================================================

export const productivityCube = defineCube('Productivity', {
  sql: 'analytics.productivity p',
  pk: ['id'],
  sampleQueries: [
    'total lines of code and average pull requests, top 5',
    'total lines of code, pull requests and deployments per month, last 6 months',
    'average lines of code with 7 period moving average per month, last 3 months',
  ],
  dimensions: {
    id: { sql: 'p.id', type: 'number' },
    date: { sql: 'p.date', type: 'time' },
    createdAt: { sql: 'p.created_at', type: 'time' },
    isDayOff: { sql: 'p.days_off', type: 'boolean' },
    happinessIndex: { sql: 'p.happiness_index', type: 'number' },
    happinessLevel: {
      sql: 'CASE WHEN p.happiness_index >= 8 THEN \'High\' WHEN p.happiness_index >= 6 THEN \'Medium\' ELSE \'Low\' END',
      type: 'string',
    },
    departmentId: { sql: 'p.department_id', type: 'number' },
    linesOfCode: { sql: 'p.lines_of_code', type: 'number' },
    pullRequests: { sql: 'p.pull_requests', type: 'number' },
  },
  measures: {
    count: { sql: 'p.id', type: 'count' },
    recordCount: { sql: 'p.id', type: 'count' },
    distinctDates: { sql: 'p.date', type: 'countDistinctApprox' },
    workingDaysCount: {
      sql: 'p.id',
      type: 'count',
      filters: [() => 'p.days_off = FALSE'],
    },
    daysOffCount: {
      sql: 'p.id',
      type: 'count',
      filters: [() => 'p.days_off = TRUE'],
    },
    avgLinesOfCode: { sql: 'p.lines_of_code', type: 'avg' },
    totalLinesOfCode: { sql: 'p.lines_of_code', type: 'sum' },
    totalPullRequests: { sql: 'p.pull_requests', type: 'sum' },
    avgPullRequests: { sql: 'p.pull_requests', type: 'avg' },
    totalDeployments: { sql: 'p.live_deployments', type: 'sum' },
    avgDeployments: { sql: 'p.live_deployments', type: 'avg' },
    avgHappinessIndex: { sql: 'p.happiness_index', type: 'avg' },
    stddevLinesOfCode: { sql: 'p.lines_of_code', type: 'stddev' },
    medianLinesOfCode: { sql: 'p.lines_of_code', type: 'median' },
    p95LinesOfCode: { sql: 'p.lines_of_code', type: 'p95' },
    stddevHappinessIndex: { sql: 'p.happiness_index', type: 'stddev' },
    medianHappinessIndex: { sql: 'p.happiness_index', type: 'median' },
    medianPullRequests: { sql: 'p.pull_requests', type: 'median' },
    p95PullRequests: { sql: 'p.pull_requests', type: 'p95' },
    productivityScore: {
      sql: '(p.lines_of_code + p.pull_requests * 50 + p.live_deployments * 100)',
      type: 'avg',
    },
    // Calculated
    workingDaysPercentage: {
      type: 'calculated',
      calculatedSql: '({Productivity.workingDaysCount} / NULLIF({Productivity.recordCount}, 0)) * 100',
    },
    avgCodePerWorkday: {
      type: 'calculated',
      calculatedSql: '{Productivity.totalLinesOfCode} / NULLIF({Productivity.workingDaysCount}, 0)',
    },
    avgPRsPerWorkday: {
      type: 'calculated',
      calculatedSql: '{Productivity.totalPullRequests} / NULLIF({Productivity.workingDaysCount}, 0)',
    },
    compositeProductivityScore: {
      type: 'calculated',
      calculatedSql: '({Productivity.totalLinesOfCode} * 0.3 + {Productivity.totalPullRequests} * 2 + {Productivity.totalDeployments} * 5) / NULLIF({Productivity.workingDaysCount}, 0)',
    },
    deploymentRate: {
      type: 'calculated',
      calculatedSql: '({Productivity.totalDeployments} / NULLIF({Productivity.workingDaysCount}, 0)) * 100',
    },
    // Window functions
    linesOfCodeChange: {
      sql: 'p.lines_of_code',
      type: 'lag',
      windowConfig: {
        orderBy: [{ field: 'date', direction: 'asc' }],
      },
    },
    previousPeriodLines: {
      sql: 'p.lines_of_code',
      type: 'lag',
      windowConfig: {
        orderBy: [{ field: 'date', direction: 'asc' }],
      },
    },
    linesPercentChange: {
      sql: 'p.lines_of_code',
      type: 'lag',
      windowConfig: {
        orderBy: [{ field: 'date', direction: 'asc' }],
      },
    },
    productivityRank: {
      type: 'rank',
      sql: 'p.lines_of_code',
      windowConfig: {
        orderBy: [{ field: 'linesOfCode', direction: 'desc' }],
      },
    },
    runningTotalLines: {
      sql: 'p.lines_of_code',
      type: 'movingSum',
      windowConfig: {
        orderBy: [{ field: 'date', direction: 'asc' }],
        frame: { type: 'rows', start: 'unbounded', end: 'current' },
      },
    },
    movingAvg7Period: {
      sql: 'p.lines_of_code',
      type: 'movingAvg',
      windowConfig: {
        orderBy: [{ field: 'date', direction: 'asc' }],
        frame: { type: 'rows', start: 6, end: 'current' },
      },
    },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'p.employee_id', target: 'e.id' },
      relationship: 'belongsTo',
    },
    Departments: {
      targetCube: 'Departments',
      keys: { source: 'p.department_id', target: 'd.id' },
      relationship: 'belongsTo',
    },
  },
})

// =============================================================================
// Performance Reviews
// =============================================================================

export const performanceReviewsCube = defineCube('PerformanceReviews', {
  sql: 'analytics.performance_reviews pr',
  pk: ['id'],
  sampleQueries: [
    'average performance rating per month, last 12 months',
    'average, min, max, median, p95, p99, stddev and variance rating by employee',
    'next and previous performance rating by employee over time',
  ],
  dimensions: {
    id: { sql: 'pr.id', type: 'number' },
    employeeId: { sql: 'pr.employee_id', type: 'number' },
    reviewerId: { sql: 'pr.reviewer_id', type: 'number' },
    reviewDate: { sql: 'pr.review_date', type: 'time' },
    periodStart: { sql: 'pr.period_start', type: 'time' },
    periodEnd: { sql: 'pr.period_end', type: 'time' },
    rating: { sql: 'pr.rating', type: 'number' },
    createdAt: { sql: 'pr.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'pr.id', type: 'count' },
    avgRating: { sql: 'pr.rating', type: 'avg' },
    minRating: { sql: 'pr.rating', type: 'min' },
    maxRating: { sql: 'pr.rating', type: 'max' },
    stddevSampRating: { sql: 'pr.rating', type: 'stddevSamp' },
    varianceSampRating: { sql: 'pr.rating', type: 'varianceSamp' },
    medianRating: { sql: 'pr.rating', type: 'median' },
    p95Rating: { sql: 'pr.rating', type: 'p95' },
    p99Rating: { sql: 'pr.rating', type: 'p99' },
    // Window functions
    ratingRank: {
      type: 'denseRank',
      sql: 'pr.rating',
      windowConfig: {
        partitionBy: ['employeeId'],
        orderBy: [{ field: 'rating', direction: 'desc' }],
      },
    },
    reviewRowNum: {
      type: 'rowNumber',
      sql: 'pr.id',
      windowConfig: {
        partitionBy: ['employeeId'],
        orderBy: [{ field: 'reviewDate', direction: 'asc' }],
      },
    },
    nextRating: {
      sql: 'pr.rating',
      type: 'lead',
      windowConfig: {
        orderBy: [{ field: 'reviewDate', direction: 'asc' }],
        offset: 1,
        defaultValue: null,
      },
    },
    prevRating: {
      sql: 'pr.rating',
      type: 'lag',
      windowConfig: {
        orderBy: [{ field: 'reviewDate', direction: 'asc' }],
      },
    },
    firstEmployeeRating: {
      type: 'firstValue',
      sql: 'pr.rating',
      windowConfig: {
        partitionBy: ['employeeId'],
        orderBy: [{ field: 'reviewDate', direction: 'asc' }],
      },
    },
    lastEmployeeRating: {
      type: 'lastValue',
      sql: 'pr.rating',
      windowConfig: {
        partitionBy: ['employeeId'],
        orderBy: [{ field: 'reviewDate', direction: 'asc' }],
      },
    },
    ratingQuartile: {
      type: 'ntile',
      sql: 'pr.id',
      windowConfig: {
        orderBy: [{ field: 'rating', direction: 'desc' }],
      },
    },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'pr.employee_id', target: 'e.id' },
      relationship: 'belongsTo',
    },
  },
})

// =============================================================================
// PR Events
// =============================================================================

export const prEventsCube = defineCube('PREvents', {
  sql: 'analytics.pr_events pre',
  pk: ['id'],
  sampleQueries: [
    'PR events count by event type, top 5 types',
    'number of PR events, unique PRs and unique actors',
  ],
  dimensions: {
    id: { sql: 'pre.id', type: 'number' },
    prNumber: { sql: 'pre.pr_number', type: 'number' },
    eventType: { sql: 'pre.event_type', type: 'string' },
    employeeId: { sql: 'pre.employee_id', type: 'number' },
    timestamp: { sql: 'pre.timestamp', type: 'time' },
    createdAt: { sql: 'pre.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 'pre.id', type: 'count' },
    uniquePRs: { sql: 'pre.pr_number', type: 'countDistinct' },
    uniqueActors: { sql: 'pre.employee_id', type: 'countDistinct' },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'pre.employee_id', target: 'e.id' },
      relationship: 'belongsTo',
    },
  },
})

// =============================================================================
// Teams
// =============================================================================

export const teamsCube = defineCube('Teams', {
  sql: 'analytics.teams t',
  pk: ['id'],
  sampleQueries: [
    'teams count by department, top 10',
    'team count and employee team count by team name, top 5',
  ],
  dimensions: {
    id: { sql: 't.id', type: 'number' },
    name: { sql: 't.name', type: 'string' },
    description: { sql: 't.description', type: 'string' },
    departmentId: { sql: 't.department_id', type: 'number' },
    createdAt: { sql: 't.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 't.id', type: 'countDistinct' },
  },
  joins: {
    Departments: {
      targetCube: 'Departments',
      keys: { source: 't.department_id', target: 'd.id' },
      relationship: 'belongsTo',
    },
    EmployeeTeams: {
      targetCube: 'EmployeeTeams',
      keys: { source: 't.id', target: 'et.team_id' },
      relationship: 'hasMany',
    },
  },
})

// =============================================================================
// Employee Teams (junction)
// =============================================================================

export const employeeTeamsCube = defineCube('EmployeeTeams', {
  sql: 'analytics.employee_teams et',
  pk: ['id'],
  sampleQueries: [
    'team membership count by role, top 5 roles',
    'lead count per team over time, last 6 months',
  ],
  dimensions: {
    id: { sql: 'et.id', type: 'number' },
    employeeId: { sql: 'et.employee_id', type: 'number' },
    teamId: { sql: 'et.team_id', type: 'number' },
    role: { sql: 'et.role', type: 'string' },
    joinedAt: { sql: 'et.joined_at', type: 'time' },
  },
  measures: {
    count: { sql: 'et.id', type: 'count' },
    uniqueEmployees: { sql: 'et.employee_id', type: 'countDistinct' },
    uniqueTeams: { sql: 'et.team_id', type: 'countDistinct' },
    leadCount: {
      sql: 'et.id',
      type: 'count',
      filters: [() => "et.role = 'lead'"],
    },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'et.employee_id', target: 'e.id' },
      relationship: 'belongsTo',
    },
    Teams: {
      targetCube: 'Teams',
      keys: { source: 'et.team_id', target: 't.id' },
      relationship: 'belongsTo',
    },
  },
})

// =============================================================================
// Skills
// =============================================================================

export const skillsCube = defineCube('Skills', {
  sql: 'analytics.skills s',
  pk: ['id'],
  sampleQueries: [
    'skill count and distinct categories by category, top 10 categories',
  ],
  dimensions: {
    id: { sql: 's.id', type: 'number' },
    name: { sql: 's.name', type: 'string' },
    category: { sql: 's.category', type: 'string' },
    createdAt: { sql: 's.created_at', type: 'time' },
  },
  measures: {
    count: { sql: 's.id', type: 'count' },
    distinctCategories: { sql: 's.category', type: 'countDistinct' },
    approxCategories: { sql: 's.category', type: 'countDistinctApprox' },
  },
  joins: {
    EmployeeSkills: {
      targetCube: 'EmployeeSkills',
      keys: { source: 's.id', target: 'es.skill_id' },
      relationship: 'hasMany',
    },
  },
})

// =============================================================================
// Employee Skills (junction)
// =============================================================================

export const employeeSkillsCube = defineCube('EmployeeSkills', {
  sql: 'analytics.employee_skills es',
  pk: ['id'],
  sampleQueries: [
    'average employee skill proficiency, top 10 employees',
    'average, median, max and min proficiency by skill name and category',
  ],
  dimensions: {
    id: { sql: 'es.id', type: 'number' },
    employeeId: { sql: 'es.employee_id', type: 'number' },
    skillId: { sql: 'es.skill_id', type: 'number' },
    proficiencyLevel: { sql: 'es.proficiency_level', type: 'number' },
    sinceDate: { sql: 'es.since_date', type: 'time' },
  },
  measures: {
    count: { sql: 'es.id', type: 'count' },
    avgProficiency: { sql: 'es.proficiency_level', type: 'avg' },
    medianProficiency: { sql: 'es.proficiency_level', type: 'median' },
    maxProficiency: { sql: 'es.proficiency_level', type: 'max' },
    minProficiency: { sql: 'es.proficiency_level', type: 'min' },
    proficiencyQuintile: {
      type: 'ntile',
      sql: 'es.proficiency_level',
      windowConfig: {
        partitionBy: ['skillId'],
        orderBy: [{ field: 'proficiencyLevel', direction: 'desc' }],
      },
    },
  },
  joins: {
    Employees: {
      targetCube: 'Employees',
      keys: { source: 'es.employee_id', target: 'e.id' },
      relationship: 'belongsTo',
    },
    Skills: {
      targetCube: 'Skills',
      keys: { source: 'es.skill_id', target: 's.id' },
      relationship: 'belongsTo',
    },
  },
})

// =============================================================================
// Sample queries for the try-playground
// =============================================================================

export const SAMPLES: { name: string; json: Record<string, unknown> }[] = [
  {
    name: 'Employee count by band and country',
    json: { measures: ['Employees.count'], dimensions: ['Employees.band', 'Employees.country'] },
  },
  {
    name: 'Top 5 departments by total budget',
    json: { measures: ['Departments.totalBudget', 'Departments.avgBudget'], order: { 'Departments.totalBudget': 'desc' }, limit: 5 },
  },
  {
    name: 'Monthly revenue and items sold',
    json: { measures: ['OrderItems.revenue', 'OrderItems.items_sold'], timeDimensions: [{ dimension: 'Orders.ordered_at', granularity: 'month' }] },
  },
  {
    name: 'Salary stats by nationality',
    json: { measures: ['Employees.avgSalary', 'Employees.minSalary', 'Employees.maxSalary'], dimensions: ['Employees.nationality'] },
  },
  {
    name: 'Productivity moving average per month',
    json: { measures: ['Productivity.totalLinesOfCode', 'Productivity.movingAvg7Period'], timeDimensions: [{ dimension: 'Productivity.date', granularity: 'month' }] },
  },
  {
    name: 'MUTATE: Create an employee',
    json: { cube: 'Employees', operation: 'create', values: { name: 'Jane Doe', email: 'jane.doe@greencube.io', sex: 'F', band: 'E2', isActive: true } },
  },
  {
    name: 'MUTATE: Update employee 1',
    json: { cube: 'Employees', operation: 'update', values: { band: 'E3' }, filters: [{ member: 'id', operator: 'equals', values: ['1'] }] },
  },
  {
    name: 'MUTATE: Delete employee 250',
    json: { cube: 'Employees', operation: 'delete', filters: [{ member: 'id', operator: 'equals', values: ['250'] }] },
  },
]

// =============================================================================
// All cubes for registration
// =============================================================================

export const allCubes = [
  employeesCube,
  departmentsCube,
  officesCube,
  productivityCube,
  performanceReviewsCube,
  prEventsCube,
  teamsCube,
  employeeTeamsCube,
  skillsCube,
  employeeSkillsCube,
] as const satisfies readonly Cube[]

// =============================================================================
// Direct execution — compiles and prints example queries to stdout
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const { CubeQueryCompiler } = await import('./lib/GreenCube.ts')
  const { SnowflakeDialect } = await import('./lib/dialects/SnowDialect.ts')

  const cubes = new Map<string, Cube>()
  for (const c of allCubes) cubes.set(c.name, c)

  const compiler = new CubeQueryCompiler(cubes, new SnowflakeDialect())

  function show(label: string, query: Record<string, unknown>): void {
    try {
      const { sql, params } = compiler.compile(query as any)
      console.log(`\n// ${'─'.repeat(68)}`)
      console.log(`// ${label}`)
      console.log(`// ${'─'.repeat(68)}`)
      console.log(sql)
      if (params.length > 0) {
        console.log(`\n-- binds: ${JSON.stringify(params)}`)
      }
    } catch (e: any) {
      console.log(`\n// ${'─'.repeat(68)}`)
      console.log(`// ERROR: ${label}`)
      console.log(`// ${'─'.repeat(68)}`)
      console.log(`  ${e.message}`)
    }
  }

  // ── Single-cube queries ─────────────────────────────────────────────────

  show('1. Headcount by band (dimension + measure)', {
    measures: ['Employees.count', 'Employees.activeCount'],
    dimensions: ['Employees.band'],
    order: { 'Employees.count': 'desc' },
  })

  show('2. Age distribution (computed dimension)', {
    measures: ['Employees.count'],
    dimensions: ['Employees.age'],
    order: { 'Employees.age': 'asc' },
  })

  show('3. Salary stats by sex & nationality (multi-dimension)', {
    measures: ['Employees.avgSalary', 'Employees.medianSalary', 'Employees.minSalary', 'Employees.maxSalary', 'Employees.stddevSalary', 'Employees.varnceSalary', 'Employees.p95Salary', 'Employees.p99Salary'],
    dimensions: ['Employees.sex', 'Employees.nationality'],
    order: { 'Employees.avgSalary': 'desc' },
  })

  show('4. Active employee percentage (calculated measure)', {
    measures: ['Employees.count', 'Employees.activeCount', 'Employees.activePercentage'],
    order: { 'Employees.activePercentage': 'desc' },
  })

  show('5. Reportees per manager (scalar subquery measure)', {
    measures: ['Employees.reporteesCount'],
    dimensions: ['Employees.name'],
    order: { 'Employees.reporteesCount': 'desc' },
    limit: 10,
  })

  // ── Multi-cube with joins ──────────────────────────────────────────────

  show('6. Employee count by office city (belongsTo join)', {
    measures: ['Employees.count'],
    dimensions: ['Offices.city'],
    order: { 'Employees.count': 'desc' },
  })

  show('7. Avg salary by department (belongsTo join)', {
    measures: ['Employees.avgSalary'],
    dimensions: ['Departments.name'],
    order: { 'Employees.avgSalary': 'desc' },
  })

  // ── CTE joins (hasMany side contributes measures) ──────────────────────

  show('8. Productivity by department with CTE pre-aggregation', {
    measures: ['Productivity.totalLinesOfCode', 'Productivity.totalPullRequests', 'Departments.count'],
    dimensions: ['Departments.name'],
    order: { 'Productivity.totalLinesOfCode': 'desc' },
  })

  show('9. Monthly productivity trends (time dimension + CTE)', {
    measures: ['Productivity.totalLinesOfCode', 'Productivity.avgLinesOfCode'],
    timeDimensions: [{ dimension: 'Productivity.date', granularity: 'month' }],
    order: { 'Productivity.date': 'asc' },
  })

  show('10. Performance review trends by employee (hasMany CTE)', {
    measures: ['PerformanceReviews.avgRating', 'PerformanceReviews.count'],
    dimensions: ['Employees.name'],
    order: { 'PerformanceReviews.avgRating': 'desc' },
  })

  // ── Window functions ───────────────────────────────────────────────────

  show('11. Lines of code with 7-period moving average', {
    measures: ['Productivity.totalLinesOfCode', 'Productivity.movingAvg7Period'],
    timeDimensions: [{ dimension: 'Productivity.date', granularity: 'month' }],
    order: { 'Productivity.date': 'asc' },
  })

  show('12. Running total lines of code (movingSum)', {
    measures: ['Productivity.totalLinesOfCode', 'Productivity.runningTotalLines'],
    timeDimensions: [{ dimension: 'Productivity.date', granularity: 'month' }],
    order: { 'Productivity.date': 'asc' },
  })

  show('13. Rating dense rank per employee (denseRank with partition)', {
    measures: ['PerformanceReviews.avgRating', 'PerformanceReviews.ratingRank'],
    dimensions: ['PerformanceReviews.employeeId'],
    order: { 'PerformanceReviews.employeeId': 'asc' },
  })

  show('14. Next & previous rating per employee (lead/lag with offset)', {
    measures: ['PerformanceReviews.ratingRank', 'PerformanceReviews.nextRating', 'PerformanceReviews.prevRating'],
    dimensions: ['PerformanceReviews.employeeId', 'PerformanceReviews.reviewDate'],
    order: { 'PerformanceReviews.employeeId': 'asc', 'PerformanceReviews.reviewDate': 'asc' },
  })

  show('15. First & last rating per employee (firstValue / lastValue)', {
    measures: ['PerformanceReviews.firstEmployeeRating', 'PerformanceReviews.lastEmployeeRating'],
    dimensions: ['PerformanceReviews.employeeId'],
  })

  show('16. Rating quartile (ntile)', {
    measures: ['PerformanceReviews.ratingQuartile'],
    dimensions: ['PerformanceReviews.employeeId'],
  })

  show('17. Productivity rank (rank window)', {
    measures: ['Productivity.productivityRank', 'Productivity.totalLinesOfCode'],
    timeDimensions: [{ dimension: 'Productivity.date', granularity: 'month' }],
    order: { 'Productivity.totalLinesOfCode': 'desc' },
  })

  // ── Skills & junction ──────────────────────────────────────────────────

  show('18. Skills by category (countDistinctApprox)', {
    measures: ['Skills.count', 'Skills.distinctCategories', 'Skills.approxCategories'],
    dimensions: ['Skills.category'],
    order: { 'Skills.count': 'desc' },
  })

  show('19. Employee proficiency by skill (belongsTo junction)', {
    measures: ['EmployeeSkills.avgProficiency', 'EmployeeSkills.medianProficiency', 'EmployeeSkills.maxProficiency', 'EmployeeSkills.minProficiency'],
    dimensions: ['Skills.name', 'Employees.name'],
    order: { 'EmployeeSkills.avgProficiency': 'desc' },
    limit: 15,
  })

  show('20. Skill proficiency quintile (ntile partitioned by skill)', {
    measures: ['EmployeeSkills.proficiencyQuintile', 'EmployeeSkills.count'],
    dimensions: ['Skills.name'],
  })

  // ── Filters ────────────────────────────────────────────────────────────

  show('21. Multiple filter operators (equals, gt, contains)', {
    measures: ['Employees.count', 'Employees.avgSalary'],
    dimensions: ['Employees.band'],
    filters: [
      { member: 'Employees.sex', operator: 'equals', values: ['F'] },
      { member: 'Employees.avgSalary', operator: 'gt', values: [50000] },
    ],
    order: { 'Employees.count': 'desc' },
  })

  show('22. Logical AND/OR with nested conditions', {
    measures: ['Employees.count', 'Employees.avgSalary'],
    dimensions: ['Employees.band', 'Employees.nationality'],
    filters: [{
      and: [
        { member: 'Employees.isActive', operator: 'equals', values: [true] },
        {
          or: [
            { member: 'Employees.band', operator: 'equals', values: ['E4'] },
            { member: 'Employees.band', operator: 'equals', values: ['E5'] },
          ],
        },
      ],
    }],
    order: { 'Employees.avgSalary': 'desc' },
  })

  show('23. ILIKE text search on employee name', {
    measures: ['Employees.count'],
    dimensions: ['Employees.name'],
    filters: [
      { member: 'Employees.name', operator: 'contains', values: ['son'] },
    ],
    order: { 'Employees.name': 'asc' },
    limit: 10,
  })

  show('24. Date range filter (inDateRange)', {
    measures: ['Employees.count'],
    dimensions: ['Employees.startDate'],
    filters: [
      { member: 'Employees.startDate', operator: 'inDateRange', values: ['2020-01-01', '2023-01-01'] },
    ],
    order: { 'Employees.startDate': 'asc' },
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  show('25. Ungrouped — raw employee data', {
    measures: ['Employees.totalSalary'],
    dimensions: ['Employees.name'],
    order: { 'Employees.name': 'asc' },
    limit: 20,
    ungrouped: true,
  })

  show('26. Three-cube query: Employees → Departments → Teams', {
    measures: ['Employees.count', 'Departments.count', 'Teams.count'],
    dimensions: ['Departments.name'],
    order: { 'Employees.count': 'desc' },
  })

  show('27. Employees with active status = notSet (NULL check)', {
    measures: ['Employees.count'],
    dimensions: ['Employees.lastWorkingDate'],
    filters: [{ member: 'Employees.lastWorkingDate', operator: 'notSet', values: [] }],
  })

  show('28. Statistical distribution: happiness median, p95, stddev', {
    measures: ['Productivity.medianHappinessIndex', 'Productivity.stddevHappinessIndex', 'Productivity.avgHappinessIndex'],
    dimensions: ['Productivity.happinessLevel'],
  })
}
