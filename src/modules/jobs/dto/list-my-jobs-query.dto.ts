import { JobPagingQueryDto } from './job-paging-query.dto';

/**
 * The employer's own feed takes paging and nothing else: it is deliberately
 * unfiltered, because an employer wants to see everything they own — every
 * status included — rather than search it.
 */
export class ListMyJobsQueryDto extends JobPagingQueryDto {}
