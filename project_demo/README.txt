/*
Copyright 2014 Vytroncs.com and Charles Weissman

This file is part of "Vytroncs HMI, the 100% Free, Open-Source SCADA/HMI Initiative"
herein referred to as "Vytronics HMI".

Vytronics HMI is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Vytronics HMI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Vytronics HMI.  If not, see <http://www.gnu.org/licenses/>.
*/

This is the default project folder. It is recommended however
to local the project folder somewhere outside the core vytronics HMI
source root and then set the environment variable VYTRONICS_PROJDIR
prior to starting the server.

Environment variables may include indirect references using
a string ${MY_ENV_VAR}. This allows environment variables to be
specified that might not be defined prior to application launch
as is the case with most hosted environments (i.e. OpenShift and Cloud9).
The indirect references may be embedded in the variable string. For
example:

setenv VYTRONICS_PROJDIR ${OPENSHIFT_DATA_DIR}/myproject

Multiple indirect variables can be inside the string and will be
expanded when the server first starts up.
 