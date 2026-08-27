import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  SoftRemoveEvent,
} from 'typeorm';
import { EventName } from '../../../common/constants/event';
import { EmployerProfile } from '../entities/profile.entity';

@Injectable()
@EventSubscriber()
export class EmployerProfileSubscriber implements EntitySubscriberInterface<EmployerProfile> {
  // Registering here (rather than relying on the @EventSubscriber() decorator)
  // is what actually attaches this subscriber to the running connection, so
  // TypeORM invokes afterSoftRemove.
  constructor(
    dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return EmployerProfile;
  }

  // Returning the promise makes TypeORM wait on the listeners before the
  // soft-remove resolves, so the listing archival is done by the time the
  // caller (the webhook) returns.
  afterSoftRemove(event: SoftRemoveEvent<EmployerProfile>): Promise<unknown[]> {
    return this.eventEmitter.emitAsync(
      EventName.EMPLOYER_PROFILE_SOFT_DELETED,
      { id: event.entityId },
    );
  }
}
