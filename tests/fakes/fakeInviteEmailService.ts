import { InviteEmailService } from '../../src/services/email/inviteEmailService';

export class FakeInviteEmailService implements InviteEmailService {
  public readonly sent: string[] = [];

  async sendSetPasswordEmail(email: string): Promise<void> {
    this.sent.push(email);
  }
}
