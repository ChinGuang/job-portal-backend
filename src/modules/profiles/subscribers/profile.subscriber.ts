import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  SoftRemoveEvent,
} from 'typeorm';
import { EventName } from '../../../common/constants/event';
import { EmployerProfile } from '../entities/profile.entity';

@Injectable()
@EventSubscriber()
export class EmployerProfileSubscriber implements EntitySubscriberInterface<EmployerProfile> {
  constructor(private eventEmitter: EventEmitter2) {}
  listenTo() {
    return EmployerProfile;
  }

  afterSoftRemove(event: SoftRemoveEvent<EmployerProfile>) {
    this.eventEmitter.emit(EventName.EMPLOYER_PROFILE_SOFT_DELETED, {
      id: event.entityId,
    });
  }
}
