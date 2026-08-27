import { PagingQueryDto } from '../../../common/dto/paging-query.dto';

/**
 * The seeker's own application feed takes paging and nothing else. Filtering
 * by status is the employer's need — they triage a listing's pile — whereas a
 * seeker tracking their search wants the whole of it.
 */
export class ListMyApplicationsQueryDto extends PagingQueryDto {}
