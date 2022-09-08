import { AdxUri } from '@adxp/common'
import { Post } from '@adxp/microblog'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  In,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm'
import { DbRecordPlugin } from '../types'
import { UserDid } from '../user-dids'
import schemas from '../schemas'
import { collectionToTableName } from '../util'

const schemaId = 'blueskyweb.xyz:Post'
const collection = 'bsky/posts'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class PostIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

  @Column('text')
  text: string

  @Column({ type: 'varchar', nullable: true })
  replyRoot?: string

  @Column({ type: 'varchar', nullable: true })
  replyParent?: string

  @Column('datetime')
  createdAt: string

  @UpdateDateColumn()
  indexedAt: Date
}

const getFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri): Promise<Post.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const validator = schemas.createRecordValidator(schemaId)
const isValidSchema = (obj: unknown): obj is Post.Record => {
  return validator.isValid(obj)
}

const setFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!isValidSchema(obj)) {
      throw new Error(`Record does not match schema: ${schemaId}`)
    }
    const post = new PostIndex()
    post.uri = uri.toString()
    post.creator = uri.host
    post.text = obj.text
    post.createdAt = obj.createdAt
    post.replyRoot = obj.reply?.root
    post.replyParent = obj.reply?.parent

    await repo.save(post)
  }

const deleteFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

const translateDbObj = (dbObj: PostIndex): Post.Record => {
  const reply = dbObj.replyRoot
    ? {
        root: dbObj.replyRoot,
        parent: dbObj.replyParent,
      }
    : undefined
  return {
    text: dbObj.text,
    reply: reply,
    createdAt: dbObj.createdAt,
  }
}

export const makePlugin = (
  db: DataSource,
): DbRecordPlugin<Post.Record, PostIndex> => {
  const repository = db.getRepository(PostIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    isValidSchema,
    set: setFn(repository),
    delete: deleteFn(repository),
    translateDbObj,
  }
}

export default makePlugin
