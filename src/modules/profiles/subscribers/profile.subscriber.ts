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
  // Pushing onto dataSource.subscribers is what actually attaches this
  // subscriber to the running connection; the @EventSubscriber() decorator
  // alone does not, so without this afterSoftRemove never fires.
  constructor(
    dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return EmployerProfile;
  }

  // Returning the promise makes TypeORM wait for the listeners before the
  // soft-remove resolves, so the listings are archived by the time the
  // caller (the webhook) returns.
  afterSoftRemove(event: SoftRemoveEvent<EmployerProfile>): Promise<unknown[]> {
    return this.eventEmitter.emitAsync(
      EventName.EMPLOYER_PROFILE_SOFT_DELETED,
      {
        id: event.entityId,
      },
    );
  }
}
