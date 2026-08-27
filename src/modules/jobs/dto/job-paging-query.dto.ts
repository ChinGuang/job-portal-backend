import { PagingQueryDto } from '../../../common/dto/paging-query.dto';

/**
 * Paging for the job feeds. The rules themselves are the API-wide ones — this
 * name survives so the jobs DTOs keep reading in their own vocabulary.
 */
export class JobPagingQueryDto extends PagingQueryDto {}
