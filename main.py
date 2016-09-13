#!/usr/bin/python
import MySQLdb
import config
import argparse

class ThatsVeryNAS:
    def __init__(self, config):
        self.db = MySQLdb.connect(host=config.dbhost,      # your host, usually localhost
                     user=config.dbuser,      # your username
                     passwd=config.dbpass,    # your password
                     db=config.dbname)        # name of the data base
        self.dbc = self.db.cursor()
        self.addpath_stored="INSERT INTO paths (path) VALUES (%s)"
        self.getpath_stored="SELECT * FROM paths WHERE path=%s"

    def IsDBInstalled(self):
        # find the main table to see if DB was set up
        self.dbc.execute("SHOW TABLES LIKE 'files'")
        if (self.dbc.rowcount > 0):
            return True
        else:
            return False

    def PathExists(self,path):
        self.dbc.execute(self.getpath_stored, {path})
        if (self.dbc.rowcount > 0):
            return True
        else:
            return False

    def AddPath(self,path):
        if (self.PathExists(path) == False):
            self.dbc.execute(self.addpath_stored, {path})
            self.db.commit()

    def __del__(self):
        self.dbc.close()
        self.db.close()

#
# Main execution
#
nas = ThatsVeryNAS(config)

parser = argparse.ArgumentParser(description='Manage your nice NAS.')
parser.add_argument('--addpath', '-p', dest='addpath', help='adds a path to look for files')
parser.add_argument('--addexclusion_pattern', '-e',
dest='addexclusion',help='adds an exlusion to ignore when scanning a path')

args = parser.parse_args()

if (args.addpath):
    nas.AddPath(args.addpath)
