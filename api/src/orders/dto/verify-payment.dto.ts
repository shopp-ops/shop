import { Matches } from 'class-validator';

export class VerifyPaymentDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'txHash must be a valid Ethereum transaction hash',
  })
  txHash: string;
}
