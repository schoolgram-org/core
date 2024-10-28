import { Field, ObjectType } from "type-graphql";
import { Exclude, Expose, Transform } from "class-transformer";
import { IsDate, IsNumber, IsString, IsBoolean, IsOptional } from "class-validator";
import { DateTime } from "luxon";

export interface NetSchoolAPISchema {
  dateformat: string;
  unknown: string;
}

@ObjectType()
export class Attachment implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsNumber()
  id: number;

  @Field()
  @IsString()
  @Expose({ name: "originalFileName" })
  name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description: string = "";
}

@ObjectType()
export class Author implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsNumber()
  id: number;

  @Field()
  @IsString()
  @Expose({ name: "fio" })
  full_name: string;

  @Field()
  @IsString()
  @Expose({ name: "nickName" })
  nickname: string;
}

@ObjectType()
export class Announcement implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsString()
  name: string;

  @Field(() => Author)
  author: Author;

  @Field()
  @IsString()
  @Expose({ name: "description" })
  content: string;

  @Field()
  @IsDate()
  @Expose({ name: "postDate" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  post_date: Date;

  @Field(() => [Attachment])
  attachments: Attachment[] = [];
}

@ObjectType()
export class Assignment implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsNumber()
  id: number;

  @Field()
  @IsString()
  comment: string;

  @Field()
  @IsString()
  type: string;

  @Field()
  @IsString()
  @Expose({ name: "assignmentName" })
  content: string;

  @Field({ nullable: true })
  @IsNumber()
  @IsOptional()
  @Expose({ name: "mark" })
  mark?: number;

  @Field()
  @IsBoolean()
  @Expose({ name: "dutyMark" })
  is_duty: boolean;

  @Field()
  @IsDate()
  @Expose({ name: "dueDate" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  deadline: Date;

  @Exclude()
  unwrapMarks(assignment: any): any {
    const mark = assignment.mark;
    if (mark) {
      Object.assign(assignment, mark);
    } else {
      assignment.mark = null;
      assignment.dutyMark = false;
    }
    const markComment = assignment.markComment;
    assignment.comment = markComment ? markComment.name : "";
    assignment.type = this.context.assignment_types[assignment.typeId];
    delete assignment.typeId;
    return assignment;
  }
}

@ObjectType()
export class Lesson implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsDate()
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  day: Date;

  @Field()
  @IsDate()
  @Expose({ name: "startTime" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  start: Date;

  @Field()
  @IsDate()
  @Expose({ name: "endTime" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  end: Date;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  room: string = "";

  @Field()
  @IsNumber()
  number: number;

  @Field()
  @IsString()
  @Expose({ name: "subjectName" })
  subject: string;

  @Field(() => [Assignment])
  assignments: Assignment[] = [];
}

@ObjectType()
export class Day implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field(() => [Lesson])
  lessons: Lesson[];

  @Field()
  @IsDate()
  @Expose({ name: "date" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  day: Date;
}

@ObjectType()
export class Diary implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsDate()
  @Expose({ name: "weekStart" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  start: Date;

  @Field()
  @IsDate()
  @Expose({ name: "weekEnd" })
  @Transform(({ value }) => DateTime.fromISO(value).toJSDate())
  end: Date;

  @Field(() => [Day])
  @Expose({ name: "weekDays" })
  schedule: Day[];
}

@ObjectType()
export class ShortSchool implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsNumber()
  id: number;

  @Field()
  @IsString()
  @Expose({ name: "addressString" })
  address: string;
}

@ObjectType()
export class School implements NetSchoolAPISchema {
  dateformat = "yyyy-MM-dd'T'00:00:00";
  unknown = "exclude";

  @Field()
  @IsString()
  @Expose({ name: "fullSchoolName" })
  name: string;

  @Field()
  @IsString()
  about: string;

  @Field()
  @IsString()
  address: string;

  @Field()
  @IsString()
  email: string;

  @Field()
  @IsString()
  @Expose({ name: "web" })
  site: string;

  @Field()
  @IsString()
  @Expose({ name: "phones" })
  phone: string;

  @Field()
  @IsString()
  director: string;

  @Field()
  @IsString()
  @Expose({ name: "principalAHC" })
  AHC: string;

  @Field()
  @IsString()
  @Expose({ name: "principalIT" })
  IT: string;

  @Field()
  @IsString()
  @Expose({ name: "principalUVR" })
  UVR: string;

  @Exclude()
  unwrapNestedDicts(school: any): any {
    Object.assign(school, school.commonInfo, school.contactInfo, school.managementInfo);
    delete school.commonInfo;
    delete school.contactInfo;
    delete school.managementInfo;
    school.address = school.juridicalAddress || school.postAddress;
    return school;
  }
}
