import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class DidDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // References the existing user schema logically

  @Column({ unique: true })
  did: string; // Decentralized identifier (e.g., did:ethr:0x...)

  @Column({ type: 'text', nullable: true })
  publicKey: string;

  @Column({ nullable: true })
  nonce: string; // For authentication challenges

  @Column({ type: 'timestamp', nullable: true })
  nonceExpiry: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}