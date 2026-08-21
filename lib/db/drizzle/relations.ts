import { relations } from "drizzle-orm/relations";
import { qaUsers, qaTestCaseHistory, qaTestCases, qaModules, qaModuleSequences, qaAccessRequests, qaAttachments } from "./schema";

export const qaTestCaseHistoryRelations = relations(qaTestCaseHistory, ({one}) => ({
	qaUser: one(qaUsers, {
		fields: [qaTestCaseHistory.changedBy],
		references: [qaUsers.id]
	}),
	qaTestCase: one(qaTestCases, {
		fields: [qaTestCaseHistory.testCaseId],
		references: [qaTestCases.id]
	}),
}));

export const qaUsersRelations = relations(qaUsers, ({many}) => ({
	qaTestCaseHistories: many(qaTestCaseHistory),
	qaTestCases_createdBy: many(qaTestCases, {
		relationName: "qaTestCases_createdBy_qaUsers_id"
	}),
	qaTestCases_performedByUserId: many(qaTestCases, {
		relationName: "qaTestCases_performedByUserId_qaUsers_id"
	}),
	qaTestCases_updatedBy: many(qaTestCases, {
		relationName: "qaTestCases_updatedBy_qaUsers_id"
	}),
	qaAccessRequests_reviewedBy: many(qaAccessRequests, {
		relationName: "qaAccessRequests_reviewedBy_qaUsers_id"
	}),
	qaAccessRequests_userId: many(qaAccessRequests, {
		relationName: "qaAccessRequests_userId_qaUsers_id"
	}),
}));

export const qaTestCasesRelations = relations(qaTestCases, ({one, many}) => ({
	qaTestCaseHistories: many(qaTestCaseHistory),
	qaUser_createdBy: one(qaUsers, {
		fields: [qaTestCases.createdBy],
		references: [qaUsers.id],
		relationName: "qaTestCases_createdBy_qaUsers_id"
	}),
	qaModule: one(qaModules, {
		fields: [qaTestCases.moduleId],
		references: [qaModules.id]
	}),
	qaUser_performedByUserId: one(qaUsers, {
		fields: [qaTestCases.performedByUserId],
		references: [qaUsers.id],
		relationName: "qaTestCases_performedByUserId_qaUsers_id"
	}),
	qaUser_updatedBy: one(qaUsers, {
		fields: [qaTestCases.updatedBy],
		references: [qaUsers.id],
		relationName: "qaTestCases_updatedBy_qaUsers_id"
	}),
	qaAttachments: many(qaAttachments),
}));

export const qaModulesRelations = relations(qaModules, ({many}) => ({
	qaTestCases: many(qaTestCases),
	qaModuleSequences: many(qaModuleSequences),
}));

export const qaModuleSequencesRelations = relations(qaModuleSequences, ({one}) => ({
	qaModule: one(qaModules, {
		fields: [qaModuleSequences.moduleId],
		references: [qaModules.id]
	}),
}));

export const qaAccessRequestsRelations = relations(qaAccessRequests, ({one}) => ({
	qaUser_reviewedBy: one(qaUsers, {
		fields: [qaAccessRequests.reviewedBy],
		references: [qaUsers.id],
		relationName: "qaAccessRequests_reviewedBy_qaUsers_id"
	}),
	qaUser_userId: one(qaUsers, {
		fields: [qaAccessRequests.userId],
		references: [qaUsers.id],
		relationName: "qaAccessRequests_userId_qaUsers_id"
	}),
}));

export const qaAttachmentsRelations = relations(qaAttachments, ({one}) => ({
	qaTestCase: one(qaTestCases, {
		fields: [qaAttachments.testCaseId],
		references: [qaTestCases.id]
	}),
}));